/* eslint-disable no-unused-expressions */
import cheerio, { Element } from 'cheerio';
import { createCanvas } from 'canvas';
import { imageSize } from 'image-size';

import { assertDefined, keys, testNever } from './generic';
import { error, info, warn } from './log';
import { defaultLightDistance, navNodeGridSize, hullDoorOutset, hullOutset, obstacleOutset, precision, svgSymbolTag, wallOutset, decorGridSize, roomGridSize, gmGridSize } from './const';
import { Poly, Rect, Mat, Vect } from '../geom';
import { extractGeomsAt, hasTitle } from './cheerio';
import { geom, sortByXThenY } from './geom';
import { imageService } from './image';
import { decorIconRadius, gridDimWorld } from '../world/const';
import { roomGraphClass } from '../graph/room-graph';
import { Builder } from '../pathfinding/Builder';
import { fillRing, supportsWebp, parseJsArg } from "../service/dom";

//#region main

/**
 * Fundamental function i.e. source of each {geomorph}.json
 * 
 * Create a layout given a definition and all symbols.
 * Can run in browser or on server.
 * @param {CreateLayoutOpts} opts
 * @returns {Promise<Geomorph.ParsedLayout>}
 */
export async function createLayout(opts) {
  /** @type {Geomorph.ParsedLayout['groups']} */
  const groups = {
    obstacles: [],
    singles: [],
    walls: [],
  };
  const m = new Mat();

  extendLayoutUsingNestedSymbols(opts);
  
  /** Last seen transform of non-nested symbol */
  let postTransform = /** @type {Geom.SixTuple} */ ([1, 0, 0, 1, 0, 0]);
  /** Previously seen non-nested symbols */
  const standards = /** @type {Geomorph.LayoutDefItem[]} */ ([]);

  /**
   * - Compute `groups`.
   * - Compute each `item.transform`.
   */
  opts.def.items.forEach((item, i) => {
    if (i === 0) {// Hull symbol
      item.transform = [1, 0, 0, 1, 0, 0];
      standards.push(item);
    } else if (!item.preTransform) {// Standard symbol
      item.transform = layoutDefItemToTransform(item, standards, opts, m).toArray();
      postTransform = item.transform; // Record for nested symbols
      standards.push(item);  // Record for `at`
    } else {// Nested symbol
      item.transform = m.feedFromArray(item.preTransform).postMultiply(postTransform).toArray();
    }
    addLayoutDefItemToGroups(item, opts, m, groups);
  });

  // Ensure well-signed polygons
  groups.singles.forEach(({ poly }) => poly.fixOrientation().precision(precision));
  groups.obstacles.forEach(({ poly }) => poly.fixOrientation().precision(precision));
  groups.walls.forEach((poly) => poly.fixOrientation().precision(precision));

  const items = opts.def.items;
  const symbols = items.map(y => opts.lookup[y.id]);
  const hullSym = symbols[0];
  const hullOutline = hullSym.hull.map(x => x.clone().removeHoles()); // Not transformed
  const windowPolys = singlesToPolys(groups.singles, 'window');
  const uncutWalls = groups.walls; // group.walls overwritten below

  // Rooms (induced by all walls)
  const allWalls = Poly.union(hullSym.hull.concat(uncutWalls, windowPolys)).map(x => x.precision(precision));
  allWalls.sort((a, b) => a.rect.area > b.rect.area ? -1 : 1); // Descending by area
  const rooms = allWalls[0].holes.map(ring => new Poly(ring));
  // Finally, internal pillars are converted into holes inside room
  allWalls.slice(1).forEach(pillar => {
    const witness = pillar.outline[0];
    const room = rooms.find(x => x.contains(witness));
    if (room) {// We ignore any holes in pillar
      room.holes.push(pillar.outline);
    } else {
      warn(`${opts.def.key}: pillar ${JSON.stringify(pillar.rect.json)} does not reside in any room`);
    }
  });

  const doors = filterSingles(groups.singles, 'door').map(x => singleToConnectorRect(x, rooms));
  doors.forEach((door, doorId) =>
    door.roomIds.includes(null) && !door.meta.hull && warn(`non-hull door ${doorId} has roomIds ${JSON.stringify(door.roomIds)}`)
  );

  /**
   * Cut doors from walls, changing `groups.walls` and `groups.singles`.
   * We do not cut out windows because conceptually easier to have one notion.
   * But when rendering we'll need to avoid drawing wall over window.
   */
  const doorPolys = getNormalizedDoorPolys(doors);
  /**
   * We cut doors from walls, without first unioning the walls.
   * We do this because our polygon outset doesn't support self-intersecting outer ring.
   */
  const unjoinedWalls = groups.walls.flatMap(x => Poly.cutOut(doorPolys, [x]));
  groups.walls = Poly.union(unjoinedWalls);
  groups.singles = groups.singles.reduce((agg, single) =>
    agg.concat(single.meta.wall
      ? Poly.cutOut(doorPolys, [single.poly]).map(poly => ({ ...single, poly }))
      : single
    )
  , /** @type {typeof groups['singles']} */ ([]));

  // Labels
  const measurer = createCanvas(0, 0).getContext('2d');
  measurer.font = labelMeta.font;
  const labels = groups.singles.filter(x => x.meta.label)
    .map(/** @returns {Geomorph.LayoutLabel} */ ({ poly, meta }, index) => {
      const center = poly.rect.center.precision(precision).json;
      const text = `${meta.label}`;
      const dim = { width: measurer.measureText(text).width, height: labelMeta.sizePx };
      const rect = Rect.fromJson({ x: center.x - 0.5 * dim.width, y: center.y - 0.5 * dim.height, width: dim.width, height: dim.height }).precision(precision).json;
      return { text, center, index, rect };
    });

  const windows = filterSingles(groups.singles, 'window').map(
    x => singleToConnectorRect(x, rooms)
  );
  windows.forEach((window, windowId) =>
    window.roomIds.includes(null) && !window.meta.hull && warn(`non-hull window ${windowId} has roomIds ${JSON.stringify(window.roomIds)}`)
  );

  const hullRect = Rect.fromRects(...hullSym.hull.concat(doorPolys).map(x => x.rect));
  doors.filter(x => x.meta.hull).forEach(door => {
    extendHullDoorTags(door, hullRect);
  });

  // Can discard disjoint nav areas
  const ignoreNavPoints = groups.singles.filter(x => x.meta['ignore-nav']).map(x => x.poly.center);

  /**
   * Navigation polygon obtained by cutting outset walls and outset obstacles
   * from `hullOutline`, thereby creating doorways (including doors, but not all of hull door).
   * 
   * Also discard polygons intersecting ignoreNavPoints, and "small areas".
   */
  const navPolyWithDoors = Poly.cutOut(
    [ // Non-unioned walls avoids outset issue (self-intersection)
      ...unjoinedWalls.flatMap(x => geom.createOutset(x, wallOutset)),
      ...groups.obstacles.flatMap(x => geom.createOutset(x.poly, obstacleOutset)),
    ],
    hullOutline,
  ).map(x => x.fixOrientation().precision(precision).cleanFinalReps()).filter(poly => {
    const { rect } = poly;
    return (
      !ignoreNavPoints.some(p => poly.contains(p))
      && rect.area > 20 * 20 // also ignore small areas
      && rect.max > 60
    );
  });

  navPolyWithDoors.forEach(({ rect }, navGroupId) => {
    doors.forEach(door => door.rect.intersects(rect) && (door.navGroupId = navGroupId));
    windows.forEach(window => window.rect.intersects(rect) && (window.navGroupId = navGroupId));
  });
  doors.forEach((door, doorId) => door.navGroupId === -1
    && warn(`door ${doorId} is not attached to any navmesh`)
  );

  /** Intersection of each door with navPoly */
  const navDoorPolys = doorPolys
    .flatMap(doorPoly => Poly.intersect([doorPoly], navPolyWithDoors))
    .map(x => x.cleanFinalReps())
  ;
  /** Navigation polygon without doors */
  const navPolySansDoors = Poly.cutOut(doorPolys, navPolyWithDoors);

  /**
   * Apply Triangle triangulation library to `navPolySansDoors`.
   * - We add the doors back manually further below
   * - Errors thrown by other code seems to trigger error at:
   *   > `{REPO_ROOT}/node_modules/triangle-wasm/triangle.out.js:9`
   */
  const navDecomp = opts.triangleService
    ? await opts.triangleService.triangulate(
        navPolySansDoors,
        {
          // minAngle: 10,
          // maxSteiner: 100,
          // maxArea: 750,
        },
      )
    : { vs: [], tris: [] };

  /**
   * Extend navDecomp with 2 triangles for each door
   * - Assume well-formed i.e. exactly 2 edges already present
   *   in the triangulation. If not we warn and skip the door.
   * - We do not ensure the sign of these triangles (e.g. clockwise)
   */
  for (const [i, { outline }] of navDoorPolys.entries()) {
    if (outline.length !== 4) {
      error(`door ${i} nav skipped: expected 4 vertices but saw ${outline.length}`);
      continue;
    }
    // 1st triangle arises from any three ids
    const ids = outline.map(p => {
      const vId = navDecomp.vs.findIndex(q => p.equalsAlmost(q, 0.0001));
      return vId === -1 ? navDecomp.vs.push(p) - 1 : vId;
    });
    const triA = /** @type {[number, number, number]} */ (ids.slice(0, 3));

    // 2nd triangle follows via distance
    tempVect.copy(navDecomp.vs[ids[3]]);
    const idDists = triA.map(id => [id, tempVect.distanceTo(navDecomp.vs[id])])
      .sort((a, b) => a[1] < b[1] ? -1 : 1);
    const triB = /** @type {[number, number, number]} */ (
      [ids[3]].concat(idDists.slice(0, 2).map(x => x[0]))
    );
    navDecomp.tris.push(triA, triB);
  }

  info('nav tris count:', navDecomp.vs.length);

  /**
   * Compute navZone using method from three-pathfinding,
   * also attaching `doorNodeIds` and `roomNodeIds`.
   * In the browser we'll use it to create a `FloorGraph`.
   * We expect it to have exactly one group.
   */
  const navZone = buildZoneWithMeta(navDecomp, doors, rooms);

  // Only warn when navigation service non-degenerate
  opts.triangleService && navZone.groups.forEach((tris, i) =>
    i > 0 && tris.length <= 12 && warn(`createLayout: unexpected small navZone group ${i} with ${tris.length} tris`)
  );

  const roomGraphJson = roomGraphClass.json(rooms, doors, windows);
  const roomGraph = roomGraphClass.from(roomGraphJson);

  /** @type {Geomorph.ParsedLayout['lightSrcs']} */
  const lightSrcs = filterSingles(groups.singles, svgSymbolTag.light)
    .filter(x => !x.meta[svgSymbolTag.floor])
    .map(({ poly, meta }) => ({
      position: poly.center,
      roomId: rooms.findIndex(room => room.contains(poly.center)),
      distance: typeof meta.distance === 'number' ? meta.distance : undefined,
    })
  );

  const floorHighlightIds = groups.singles.flatMap(({ meta }, index) =>
    meta[svgSymbolTag.light] && meta[svgSymbolTag.floor] ? [index] : []
  );
  const surfaceIds = groups.obstacles.flatMap(({ meta }, index) =>
    meta[svgSymbolTag.surface] ? [index] : []
  );

  const roomSurfaceIds = surfaceIds.reduce((agg, surfaceId) => {
    const surfaceCenter = groups.obstacles[surfaceId].poly.center;
    const roomId = rooms.findIndex(roomPoly => roomPoly.contains(surfaceCenter));
    roomId === -1
      ? warn(`createLayout ${opts.def.id}: surface ${surfaceId} center not in any room`)
      : (agg[roomId] ||= []).push(surfaceId);
    return agg;
  }, /** @type {Record<number, number[]>} */ ({}));

  const gridToRoomIds = rooms.reduce((agg, roomPoly, roomId) => {
    const doorPolys = getNormalizedDoorPolys(roomGraph.getAdjacentDoors(roomId).map(x => doors[x.doorId]));
    const { rect } = Poly.union([roomPoly, ...doorPolys])[0];
    addToRoomGrid(roomId, rect, agg);
    return agg;
  }, /** @type {Nav.ZoneWithMeta['gridToNodeIds']} */  ({}));

  /**
   * Each `relate-connectors` relates a doorId to other doorId(s) or windowId(s).
   * We'll use them to extend the view polygon e.g. when doors face one another.
   */
  const relDoorId = groups.singles
    .filter(x => x.meta[svgSymbolTag['relate-connectors']])
    .reduce((agg, { poly }, i) => {
      /**
       * Doors intersecting the "relate-connectors"-tagged rect,
       * sorted "spatially" i.e. indices are adjacent iff the
       * respective doors are (w.r.t. the rectangle).
       */
      const doorIds = doors
        .flatMap((door, doorId) => geom.convexPolysIntersect(door.poly.outline, poly.outline) ? doorId : [])
        .sort((a, b) => sortByXThenY(doors[a].entries[0], doors[b].entries[0]))
      ;

      const windowIds = windows.flatMap((window, windowId) => geom.convexPolysIntersect(window.poly.outline, poly.outline) ? windowId : []);
      doorIds.forEach(srcDoorId => {
        const item = (agg[srcDoorId] ??= { doors: [], windows: [], metas: {} });
        // ℹ️ must avoid dups e.g. relation from symbol vs relation from hull symbol
        item.doors.push(...doorIds.filter(x => x !== srcDoorId && !item.doors.includes(x)));
        item.windows.push(...windowIds);
        
        item.doors.forEach(dstDoorId => {
          const srcDoor = doors[srcDoorId];
          item.metas[dstDoorId] ??= {
            behind: /** @type {[boolean, boolean]} */ (srcDoor.roomIds.map(srcRoomId => {
              if (srcRoomId !== null) {
                const viewDir = srcDoor.normal.clone().scale(srcDoor.roomIds[0] === srcRoomId ? -1 : 1);
                return doors[dstDoorId].poly.center.sub(srcDoor.poly.center).dot(viewDir) <= 0;
              } else {
                return false;
              }
            })),
          };

          const [srcIndex, dstIndex] = [srcDoorId, dstDoorId].map(x => doorIds.indexOf(x))
          // Ignore dstDoorId if it comes from another relation
          // Also, avoid constructing empty depIds
          if (dstIndex >= 0 && Math.abs(dstIndex - srcIndex) > 1) {
            const depIds = item.metas[dstDoorId].depIds ??= [];
            depIds.push(
              ...(dstIndex > srcIndex
                ? doorIds.slice(srcIndex + 1, dstIndex)
                : doorIds.slice(dstIndex + 1, srcIndex).reverse()
              ).filter(x => !depIds.includes(x)), // ℹ️ must avoid dups
            );
          }
        });
      });
      if (doorIds.length === 0)
        warn(`${opts.def.id}: #${i + 1} poly tagged "${svgSymbolTag['relate-connectors']}" doesn't intersect any door: (windowIds ${windowIds})`);
      if (doorIds.length + windowIds.length <= 1)
        warn(`${opts.def.id}: #${i + 1} poly tagged "${svgSymbolTag['relate-connectors']}" should intersect ≥ 2 doors/windows (doorIds ${doorIds}, windowIds ${windowIds})`);
      return agg;
    },
    /** @type {Geomorph.RelDoor} */ ({}),
  );

  const parallelDoorId = groups.singles
    .filter(x => x.meta[svgSymbolTag["parallel-connectors"]])
    .reduce((agg, { poly }) => {
      const doorIds = doors.flatMap((door, doorId) => geom.convexPolysIntersect(door.poly.outline, poly.outline) ? doorId : []);
      doorIds.forEach(doorId => {
        agg[doorId] ??= { doors: [] };
        const alreadySeen = agg[doorId].doors;
        agg[doorId].doors.push(...doorIds.filter(x => x !== doorId && !alreadySeen.includes(x)));
      });
      if (doorIds.length <= 1)
        warn(`poly tagged "${svgSymbolTag["parallel-connectors"]}" should intersect ≥ 2 doors: (doorIds ${doorIds})`);
      return agg;
    },
    /** @type {Geomorph.ParallelDoor} */ ({}),
  );

  /** @type {Geomorph.ParsedLayout['roomMetas']} */
  const roomMetas = rooms.map((_, roomId) => {
    const adjDoors = roomGraph.getAdjacentDoors(roomId).map(x => doors[x.doorId]);
    return {
      roomId,
      hull: adjDoors.some(x => x.meta.hull),
      leaf: adjDoors.length <= 1,
      // ...
    };
  });

  return {
    key: opts.def.key,
    id: opts.def.id,
    def: opts.def,
    groups,
  
    rooms,
    doors,
    windows,
    labels,
  
    navPoly: navPolyWithDoors,
    navZone,
    roomGraph,
    lightSrcs,
    lightThrus: computeLightThruConnectors({ doors, lightSrcs, roomGraph, rooms, windows }),
    floorHighlightIds,

    roomSurfaceIds,
    roomMetas,
    gridToRoomIds,

    relDoorId,
    parallelDoorId,

    meta: {
      standard: (101 <= opts.def.id) && (opts.def.id < 300),
      edge: isEdgeGeomorph(opts.def.id),
      corner: (501 <= opts.def.id) && (opts.def.id < 700),
      // ...
    },
    
    hullPoly: hullSym.hull.map(x => x.clone()),
    hullTop: Poly.cutOut(doorPolys.concat(windowPolys), hullSym.hull),
    hullRect,
  
    items: symbols.map(/** @returns {Geomorph.ParsedLayout['items'][0]} */  (sym, i) => ({
      key: sym.key,
      svgPngScale: sym.svgPngScale,
      // `/assets/...` is a live URL, and also a dev env path if inside `/static`
      pngHref: i ? `/assets/symbol/${sym.key}.png` : `/assets/debug/${opts.def.key}.png`,
      pngRect: sym.pngRect,
      transformArray: items[i].transform,
      transform: items[i].transform ? `matrix(${items[i].transform})` : undefined,
      invert: items[i].invert,
      lighten: items[i].lighten,
    })),
  };
}

/**
 * @typedef CreateLayoutOpts
 * @property {Geomorph.LayoutDef} def
 * @property {Geomorph.SymbolLookup} lookup
 * @property {null | import('./triangle').TriangleService} triangleService
 * If the triangulation service is not provided, then e.g.
 * @see {Geomorph.ParsedLayout.navZone} is degenerate.
 */

/**
 * Mutates matrix @see {m} and returns it.
 * @param {Geomorph.LayoutDefItem} item
 * @param {CreateLayoutOpts} opts 
 * @param {Mat} m 
 * @param {Geomorph.ParsedLayout['groups']} groups
 */
function addLayoutDefItemToGroups(item, opts, m, groups) {
  const { singles, obstacles, walls, hull } = opts.lookup[item.id];
  
  if (opts.def.items[0] !== item) {
      /**
       * Starship symbol PNGs are 5 times larger than geomorph PNGs.
       * We skip 1st item i.e. hull, which corresponds to a geomorph PNG.
       */
      m.a *= 0.2,
      m.b *= 0.2,
      m.c *= 0.2,
      m.d *= 0.2;
  }

  // Transform singles, restricting doors/walls by item.tags
  // Room orientation tags permit decoding orient={deg} tags later
  const restrictedSingles = singles
    .map(({ meta, poly }) => ({
      meta: modifySinglesMeta({...meta}, m),
      poly: poly.clone().applyMatrix(m).precision(precision),
    }))
    .filter(({ meta }) => {
      const tags = Object.keys(meta);
      return item.doors && meta.door
        ? tags.some(tag => /** @type {string[]} */ (item.doors).includes(tag))
        : (item.walls && tags.includes('wall'))
          ? tags.some(tag => /** @type {string[]} */ (item.walls).includes(tag))
          : true;
    })
  ;
  groups.singles.push(...restrictedSingles);
  groups.obstacles.push(...obstacles.map(({ meta, poly }) => ({
    meta,
    poly: poly.clone().cleanFinalReps().applyMatrix(m).precision(precision),
  })));

  /**
   * Only the hull symbol (the 1st symbol) has "hull" walls.
   * Outset the hull _inwards_ to ensure 👉 _clean union with other walls_.
   * We avoid outwards outset for cleanliness.
   */
  const transformedHull = hull.map(x => x.applyMatrix(m));
  const inwardsOutsetHull = Poly.intersect(
    transformedHull.map(x => x.clone().removeHoles()),
    transformedHull.flatMap(x => geom.createOutset(x, hullOutset)),
  );
  groups.walls.push(...Poly.union([
    ...walls.map(x => x.clone().applyMatrix(m)),
    // singles can also have walls e.g. to support optional doors
    ...singlesToPolys(restrictedSingles, 'wall'),
    // ...hull.flatMap(x => x.createOutset(hullOutset)).map(x => x.applyMatrix(m)),
    ...inwardsOutsetHull,
  ]));
}

/**
 * Mutates matrix @see {m} and returns it.
 * @param {Geomorph.LayoutDefItem} item
 * @param {Geomorph.LayoutDefItem[]} prevItems Previous non-nested symbols
 * @param {CreateLayoutOpts} opts
 * @param {Mat} m 
 * @returns {Mat}
 */
function layoutDefItemToTransform(item, prevItems, opts, m) {
  if (item.transform) {// Can override
    return m.feedFromArray(item.transform);
  }

  m.setIdentity();

  if (item.a) {
    item.a === 90 && m.feedFromArray([0, 1, -1, 0, 0, 0]) // m.setRotation(Math.PI/2)
      || item.a === 180 && m.feedFromArray([-1, 0, 0, -1, 0, 0]) // m.setRotation(Math.PI)
      || item.a === 270 && m.feedFromArray([0, -1, 1, 0, 0, 0]) // m.setRotation(3/2 * Math.PI)
  }
  if (item.flip) {
    item.flip === 'x' && m.postMultiply([1, 0, 0, -1, 0, 0])
      || item.flip === 'y' && m.postMultiply([-1, 0, 0, 1, 0, 0])
      || item.flip === 'xy' && m.postMultiply([-1, 0, 0, -1, 0, 0]);
  }

  if (item.at && prevItems.length) {
    const prevItem = assertDefined(prevItems.at(atChoiceToDelta(item.at)));
    const { width, height } = opts.lookup[prevItem.id];
    const prevM = (new Mat).feedFromArray(prevItem.transform ?? [1, 0, 0, 1, 0, 0]);
    const rect = new Rect(0, 0, width / 5, height / 5).applyMatrix(prevM);
    if (item.at === '👉' || item.at === '⏪👉' || item.at === '⏪⏪👉') {
      // `x` relative to right of previous item
      item.x = (item.x ?? 0) + rect.right;
      // `y` relative to top of previous item
      item.y = (item.y ?? 0) + (prevItem.y ?? 0);
    } else if (item.at === '👇' || item.at === '⏪👇') {
      // `y` relative to bottom of previous item
      item.y = (item.y ?? 0) + rect.bottom;
      // `x` relative to left of previous item
      item.x = (item.x ?? 0) + (prevItem.x ?? 0);
    }
  }

  // Compute top left of symbol's AABB _after_ transformation
  const { width, height } = opts.lookup[item.id];
  const { x, y } = (new Rect(0, 0, width, height)).applyMatrix(m);
  // Account for `- * 5` scale factor of non-hull symbols
  m.e = (item.x ?? 0) - x / 5;
  m.f = (item.y ?? 0) + (item.dy ?? 0) - y / 5;
  return m;
}
/**
 * @param {Geomorph.LayoutAtChoice} at 
 */
function atChoiceToDelta(at) {
  switch (at) {
    case '👉': return -1;
    case '👇': return -1;
    case '⏪⏪👉': return -3;
    case '⏪👇': return -2;
    case '⏪👉': return -2;
    default: throw testNever(at);
  }
}

/**
 * Some hull doors shouldn't be tagged,
 * e.g. the central and right one in geomorph 301.
 * They are not connectable to other geomorphs.
 * @param {Geomorph.ConnectorRect} door 
 * @param {Geom.Rect} hullRect 
 */
function extendHullDoorTags(door, hullRect) {
  const bounds = door.poly.rect.clone().outset(4); // 🚧
  if (bounds.y <= hullRect.y) door.meta.hullDir = 'n';
  else if (bounds.right >= hullRect.right) door.meta.hullDir = 'e';
  else if (bounds.bottom >= hullRect.bottom) door.meta.hullDir = 's';
  else if (bounds.x <= hullRect.x) door.meta.hullDir = 'w';
}

/**
 * Symbols can reference others:
 * we insert the latter into the layout.
 * This function mutates @see {opts}
 * @param {CreateLayoutOpts} opts
 */
function extendLayoutUsingNestedSymbols(opts) {
  opts.def.items = opts.def.items.reduce((agg, item) => {
    try {
      agg.push(item);
      opts.lookup[item.id].singles.forEach(x => {
        if (x.meta.symbol) {
          if (/** @type {string} */ (x.meta.key) in opts.lookup) {
            agg.push(symbolSingleToLayoutItem(x));
          } else warn(`inner symbol lacks valid key (${JSON.stringify(item)})`);
        }
      });
      return agg;
    } catch (e) {
      error(`${item.id}: ${e}`);
      throw e;
    }
  }, /** @type {typeof opts.def.items} */ ([]));
}

/**
 * e.g. `foo--bar--3x2.png` yields `[3, 2]` in Geomorph Grid Coordinates.
 * @param {Geomorph.SymbolKey} key 
 * @returns {[number, number]}
 */
function getGridDimFromSymbolKey(key) {
  if (key.endsWith('--hull')) {
    const gmId = Number(key.split('--')[0]);
    return isEdgeGeomorph(gmId) ? [20, 10] : [20, 20];
  } else {
    return /** @type {[number ,number]} */ (
      /** @type {string} */ (key.split('--').pop()).split('x').map(Number)
    );
  }
}

/**
 * @param {Geomorph.SvgGroupWithTags<Poly>} single 
 * @returns {Geomorph.LayoutDefItem}
 */
function symbolSingleToLayoutItem({ meta }) {
  // console.log('saw nested symbol', meta, rect);
  const { x, y } = /** @type {Geom.VectJson} */ (meta._ownOrigin);
  const m = new Mat([1, 0, 0, 1, x, y]);
  if (meta._ownTransform) {
    m.postMultiply(/** @type {Geom.SixTuple} */ (meta._ownTransform));
  }
  return {
    id: /** @type {Geomorph.SymbolKey} */ (meta.key),
    preTransform: m.toArray(),
    ...typeof meta.invert === 'boolean' && { invert: meta.invert },
  };
}

/**
 * @param {Geomorph.ConnectorRect} connector
 * @param {Geom.VectJson} viewPos local position inside geomorph
 * @returns {[Geom.Vect, Geom.Vect]}
 */
export function getConnectorOtherSide(connector, viewPos) {
  const { baseRect, normal, seg } = connector;
  const depth = baseRect.min;
  const sign = Vect.from(seg[0]).sub(viewPos).dot(normal) >= 0 ? 1 : -1
  // 🚧 0.5 ensures we at least "close the outline"
  const delta = (sign * depth/2) * 0.5;
  return [
    seg[0].clone().addScaledVector(normal, delta),
    seg[1].clone().addScaledVector(normal, delta)
  ];
}

/**
 * @param {number} gmId 
 * @param {number} roomId 
 */
export function getGmDoorKey(gmId, roomId) {
  return `g${gmId}-d${roomId}`;
}

/**
 * @param {number} gmId 
 * @param {number} roomId 
 */
export function getGmRoomKey(gmId, roomId) {
  return `g${gmId}-r${roomId}`;
}

/**
 * Hull door polys are outset along entry to e.g. ensure they intersect room.
 * Our hull doors have width 8, whereas original have width 12, so we outset by 2.
 * @param {Geomorph.ConnectorRect[]} doors
 * @returns {Geom.Poly[]}
 */
export function getNormalizedDoorPolys(doors) {
  return doors.map(door =>
    door.meta.hull ? outsetConnectorEntry(door, hullDoorOutset) : door.poly
  );
}

/**
 * Returns -1 if no unseen room id found.
 * @param {Geomorph.ConnectorRect} connector
 * @param {number[]} seenRoomIds could be frontier array of bfs
 */
export function getUnseenConnectorRoomId(connector, seenRoomIds) {
  return connector.roomIds.find(id => id !== null && !seenRoomIds.includes(id)) ?? -1;
}

/**
 * @param {Geomorph.GeomorphKey | number} idOrKey 
 */
function isEdgeGeomorph(idOrKey) {
  // g-{id}--foo -> {id}
  typeof idOrKey !== 'number' && (idOrKey = parseInt(idOrKey.slice(2)))
  return (301 <= idOrKey) && (idOrKey < 500);
}

/**
 * e.g. 101--hull
 * @param {Geomorph.SymbolKey} symbolKey 
 */
function isHullSymbolKey(symbolKey) {
  return symbolKey.endsWith('--hull');
}

/**
 * @param {Geomorph.PointMeta} meta 
 * @param {Mat} roomTransformMatrix 
 */
function modifySinglesMeta(meta, roomTransformMatrix) {
  if (typeof meta.orient === 'number') {// orientation must reflect parent room's transformation
    const newDegrees = roomTransformMatrix.transformAngle(meta.orient * (Math.PI / 180)) * (180 / Math.PI);
    meta.orient = Math.round(newDegrees < 0 ? 360 + newDegrees : newDegrees);
  }
  if (typeof meta.angle === 'number') {
    const newDegrees = roomTransformMatrix.transformAngle(meta.angle * (Math.PI / 180)) * (180 / Math.PI);
    meta.angle = Math.round(newDegrees < 0 ? 360 + newDegrees : newDegrees);
  }
  return meta;
}

/**
 * Outset connector rect along entry normal.
 * @param {Geomorph.ConnectorRect} connector
 * @param {number} amount
 * @returns {Geom.Poly}
 */
function outsetConnectorEntry(connector, amount) {
  const { seg: [u, v], normal, baseRect: { height } } = connector;
  const halfHeight = amount + (height/2);
  return new Poly([
    u.clone().addScaledVector(normal, -halfHeight),
    v.clone().addScaledVector(normal, -halfHeight),
    v.clone().addScaledVector(normal, halfHeight),
    u.clone().addScaledVector(normal, halfHeight),
  ]);
}

/**
 * @param {Record<any, any>} meta 
 * @returns {meta is { gmId: number; doorId: number; }}
 */
export function hasGmDoorId(meta) {
  return meta && typeof meta.gmId === 'number' && typeof meta.doorId === 'number';
}

/**
 * @param {Record<any, any>} meta 
 * @returns {meta is { gmId: number; roomId: number; }}
 */
export function hasGmRoomId(meta) {
  return meta && typeof meta.gmId === 'number' && typeof meta.roomId === 'number';
}

/**
 * Is the connector aligned with horizontal or vertical axis?
 * @param {Geomorph.ConnectorRect} connector 
 */
export function isConnectorOrthonormal(connector) {
  return connector.normal.x === 0 || connector.normal.y === 0;
}

/**
 * @param {Geomorph.GmRoomId} gmRoomId 
 * @param {Geomorph.GmRoomId} otherGmRoomId 
 * @returns {boolean}
 */
export function isSameGmRoom(gmRoomId, otherGmRoomId) {
  return (
    gmRoomId.gmId === otherGmRoomId.gmId
    && gmRoomId.roomId === otherGmRoomId.roomId
  );
}

/**
 * @param {Geomorph.ConnectorRectJson} x
 * @returns {Geomorph.ConnectorRect}
 */
function parseConnectorRect(x) {
  const poly = Poly.from(x.poly);
  return {
    ...x,
    baseRect: Rect.fromJson(x.baseRect),
    poly,
    rect: poly.rect,
    normal: Vect.from(x.normal),
    seg: [Vect.from(x.seg[0]), Vect.from(x.seg[1])],
    entries: [
      Vect.from(x.entries[0]),
      Vect.from(x.entries[1]),
    ],
  }
}

/**
 * @param {Geomorph.SvgGroupWithTags<Geom.Poly>} single 
 * @param {Geom.Poly[]} rooms 
 * @returns {Geomorph.ConnectorRect}
 */
function singleToConnectorRect(single, rooms) {
  const { poly, meta } = single;
  const { angle, baseRect } = poly.outline.length === 4
    ? geom.polyToAngledRect(poly)
    : { baseRect: poly.rect, angle: 0 } // curved windows use aabb
  ;
  const [u, v] = geom.getAngledRectSeg({ angle, baseRect });
  const normal = v.clone().sub(u).rotate(Math.PI / 2).normalize();

  const doorEntryDelta = (Math.min(baseRect.width, baseRect.height)/2) + 0.05;
  const infront = poly.center.addScaledVector(normal, doorEntryDelta).precision(precision);
  const behind = poly.center.addScaledVector(normal, -doorEntryDelta).precision(precision);
  const moreInfront = infront.clone().addScaledVector(normal, hullDoorOutset);
  const moreBehind = behind.clone().addScaledVector(normal, -hullDoorOutset);

  /** @type {[null | number, null | number]} */
  const roomIds = rooms.reduce((agg, room, roomId) => {
    // Support doors connecting a room to itself e.g.
    // galley-and-mess-halls--006--4x2
    if (room.contains(moreInfront)) agg[0] = roomId;
    if (room.contains(moreBehind)) agg[1] = roomId;
    return agg;
  }, /** @type {[null | number, null | number]} */ ([null, null]));

  return {
    angle,
    baseRect: baseRect.precision(precision),
    poly,
    rect: poly.rect.precision(precision),
    meta,
    seg: [u.precision(precision), v.precision(precision)],
    normal: normal.precision(precision),
    roomIds,
    entries: [infront, behind],
    navGroupId: -1, // Augmented later
  };
}

/** @param {Geomorph.ParsedLayout} layout */
export function serializeLayout({
  def, groups,
  rooms, doors, windows, labels, navPoly, navZone, roomGraph,
  lightSrcs, lightThrus, floorHighlightIds,
  roomSurfaceIds, roomMetas, gridToRoomIds,
  relDoorId, parallelDoorId,
  meta,
  hullPoly, hullRect, hullTop,
  items,
}) {
  /** @type {Geomorph.LayoutJson} */
  const json = {
    key: def.key,
    id: def.id,

    def,
    groups: {
      obstacles: groups.obstacles.map(x => ({ meta: x.meta, poly: x.poly.geoJson })),
      singles: groups.singles.map(x => ({ meta: x.meta, poly: x.poly.geoJson })),
      walls: groups.walls.map(x => x.geoJson),
    },

    rooms: rooms.map(x => x.geoJson),
    doors: doors.map((x) => ({ ...x, poly: x.poly.geoJson })),
    windows: windows.map((x) => ({ ...x, poly: x.poly.geoJson })),
    labels,
    navPoly: navPoly.map(x => x.geoJson),
    navZone,
    roomGraph: roomGraph.plainJson(),
    lightSrcs: lightSrcs.map(({ position, roomId, distance }) => ({
      position: position.json,
      roomId,
      distance,
    })),
    lightThrus: lightThrus.map(x => ({
      ...x,
      rect: x.rect.json,
      poly: x.poly.geoJson,
    })),
    floorHighlightIds,
    roomSurfaceIds,
    roomMetas,
    gridToRoomIds,
    relDoorId,
    parallelDoorId,
    meta,

    hullPoly: hullPoly.map(x => x.geoJson),
    hullRect,
    hullTop: hullTop.map(x => x.geoJson),

    items,
  };
  return json;
}

/**
 * @template T
 * @param {Geomorph.PointMeta} meta 
 * @param {RegExp} regex
 * @param {(matching: RegExpMatchArray) => T} [transform]
 * @returns {T | undefined}
 */
export function matchedMap(meta, regex, transform) {
  let matching = /** @type {RegExpMatchArray | null} */ (null);
  Object.keys(meta).find(tag => matching = tag.match(regex));
  if (transform) {
    return matching ? transform(matching) : undefined;
  } else {// Default to full matching, assuming T is string
    return /** @type {*} */ (matching?.[0]);
  }
}

/** @param {Geomorph.LayoutJson} layout */
export function parseLayout({
  def, groups,
  rooms, doors, windows, labels, navPoly, navZone, roomGraph,
  lightSrcs, lightThrus, floorHighlightIds, roomSurfaceIds, roomMetas, gridToRoomIds,
  relDoorId, parallelDoorId,
  meta,
  hullPoly, hullRect, hullTop,
  items,
}) {
  /** @type {Geomorph.ParsedLayout} */
  const parsed = {
    key: def.key,
    id: def.id,

    def,
    groups: {
      obstacles: groups.obstacles.map(x => ({ meta: x.meta, poly: Poly.from(x.poly) })),
      singles: groups.singles.map(x => ({ meta: x.meta, poly: Poly.from(x.poly) })),
      walls: groups.walls.map(Poly.from),
    },

    rooms: rooms.map(Poly.from),
    doors: doors.map(parseConnectorRect),
    windows: windows.map(parseConnectorRect),
    labels,
    navPoly: navPoly.map(Poly.from),
    navZone,
    roomGraph: roomGraphClass.from(roomGraph),
    lightSrcs: lightSrcs.map(x => ({
      position: Vect.from(x.position),
      distance: x.distance,
      roomId: x.roomId,
    })),
    lightThrus: lightThrus.map(x => ({
      ...x,
      rect: Rect.fromJson(x.rect),
      poly: Poly.from(x.poly),
    })),
    floorHighlightIds,
    roomSurfaceIds,
    roomMetas,
    relDoorId,
    gridToRoomIds,
    parallelDoorId,
    meta,

    hullPoly: hullPoly.map(Poly.from),
    hullRect,
    hullTop: hullTop.map(Poly.from),

    items,
  };
  return parsed;
}

/**
 * Server-side only.
 * @param {Geomorph.SymbolKey} symbolKey
 * @param {string} svgContents
 * @param {number} lastModified
 * @returns {Geomorph.ParsedSymbol<Poly>}
 */
export function parseStarshipSymbol(symbolKey, svgContents, lastModified) {
  const $ = cheerio.load(svgContents);
  const topNodes = Array.from($('svg > *'));

  let pngRect = tryExtractPngRect($);
  if (pngRect === null) {
    pngRect = getSvgViewBoxRect($);
    info(`${symbolKey} is using viewBox for pngRect ${JSON.stringify(pngRect)}`);
  }
  if (isHullSymbolKey(symbolKey)) {// Trim hull door protrusions
    pngRect = Rect.fromJson(pngRect).inset(hullDoorOutset).json;
    if (isEdgeGeomorph(parseInt(symbolKey)) && (pngRect.height + 2 * hullDoorOutset) > 614) {
      // Edge geomorphs may absorb hull door protrusion e.g. guns or satellite dish
      pngRect.y -= hullDoorOutset;
      pngRect.height += hullDoorOutset;
    }
  }

  const [,, width, height] = $('svg').attr('viewBox')?.split(' ').map(Number) ?? [];
  if (width === undefined || height === undefined) {
    error(`${symbolKey}: symbol must have viewBox on <svg>`);
  }

  const scale = symbolKey.endsWith('--hull') ? 1 : 1 / 5;
  const hull = extractGeomsAt($, topNodes, 'hull', scale);
  const obstacles = extractGeomsAt($, topNodes, 'obstacles', scale);
  const singles = extractGeomsAt($, topNodes, 'singles', scale);
  const walls = extractGeomsAt($, topNodes, 'walls', scale);

  const gridDim = getGridDimFromSymbolKey(symbolKey);
  if ((width / gridDim[0]) !== (height / gridDim[1])) {
    warn(`${symbolKey}: symbol aspect ratio does not match filename`);
  }

  let svgPngScale = 1;
  if (!isHullSymbolKey(symbolKey)) {
    try {// compare PNG size to `pngRect` to infer `svgPngScale`
      const imgDim = imageSize(`static/assets/symbol/${symbolKey}.png`);
      typeof imgDim.width === 'number' && (svgPngScale = imgDim.width / pngRect.width);
    } catch {
      warn(`${symbolKey}: ignored missing png`)
    }
  }

  return {
    key: symbolKey,
    hull: Poly.union(hull).map(x => x.precision(precision)),
    lastModified,
    obstacles: obstacles.map((/** @type {*} */ poly) => ({ meta: tagsToMeta(poly._ownTags, {}), poly })),
    pngRect,
    singles: singles.map((/** @type {*} */ poly) => ({ meta: tagsToMeta(poly._ownTags, {}), poly })),
    width,
    height,
    svgPngScale,
    walls: Poly.union(walls).map(x => x.precision(precision)),
  };
}

/**
 * Create serializable data associated to a static/assets/symbol/{symbol}.
 * It will be serialized inside svg.json.
 * @param {Geomorph.ParsedSymbol<Poly>} parsed
 * @returns {Geomorph.ParsedSymbol<Geom.GeoJsonPolygon>}
 */
export function serializeSymbol(parsed) {
  return {
    key: parsed.key,
    hull: toJsons(parsed.hull),
    obstacles: parsed.obstacles.map(({ meta, poly }) => ({ meta, poly: poly.geoJson })),
    walls: toJsons(parsed.walls),
    singles: parsed.singles.map(({ meta, poly }) => ({ meta, poly: poly.geoJson })),
    width: parsed.width,
    height: parsed.height,
    svgPngScale: parsed.svgPngScale,
    pngRect: parsed.pngRect,
    lastModified: parsed.lastModified,
  };
}

/**
 * @param {Geomorph.ParsedSymbol<Geom.GeoJsonPolygon>} json
 * @returns {Geomorph.ParsedSymbol<Poly>}
 */
function deserializeSymbol(json) {
  return {
    key: json.key,
    hull: json.hull.map(Poly.from),
    obstacles: json.obstacles.map(({ meta, poly }) => ({ meta, poly: Poly.from(poly) })),
    walls: json.walls.map(Poly.from),
    singles: json.singles.map(({ meta, poly }) => ({ meta, poly: Poly.from(poly) })),
    pngRect: json.pngRect,
    width: json.width,
    height: json.height,
    svgPngScale: json.svgPngScale,
    lastModified: json.lastModified,
  };
}

/** @param {Geomorph.SvgJson} svgJson  */
export function deserializeSvgJson(svgJson) {
  return Object.values(svgJson).reduce(
    (agg, item) => (agg[item.key] = deserializeSymbol(item)) && agg,
    /** @type {Geomorph.SymbolLookup} */ ({}),
  );
}

/**
 * Each symbol can have a copy of the original PNG in group `background`.
 * It may have been offset e.g. so doors are aligned along border,
 * and we return the respective rectangle.
 * @param {import('cheerio').CheerioAPI} api
 * @returns {Geom.RectJson | null}
 */
function tryExtractPngRect(api) {
  const topNodes = Array.from(api('svg > *'));
  const group = topNodes.find(x => hasTitle(api, x, 'background'));
  const image = group ? api(group).children('image').toArray()[0] : null;
  if (image) {
    const { attribs: a } = image;
    return {
      x: Number(a.x ?? 0),
      y: Number(a.y ?? 0),
      width: Number(a.width ?? 0),
      height: Number(a.height ?? 0),
    };
  } else {
    return null;
  }
}

/**
 * @param {import('cheerio').CheerioAPI} api
 * @returns {Geom.RectJson}
*/
function getSvgViewBoxRect(api) {
  const { viewBox } = api('svg').toArray()[0].attribs;
  const [x, y, width, height] = viewBox.split(' ').map(Number);
  return { x, y, width, height };
}


/** @param {Poly[]} polys */
function toJsons(polys) {
  return polys.map(x => x.geoJson);
}

/**
 * - `GeomorphData` extends `ParsedLayout` and comes from `useGeomorph`
 * - `GeomorphDataInstance` extends `GeomorphData`,
 *   is relative to `transform` and comes from `useGeomorphs`
 * @param {Geomorph.GeomorphData} gm 
 * @param {number} gmId
 * @param {[number, number, number, number, number, number]} transform 
 */
export function geomorphDataToInstance(gm, gmId, transform) {
  const matrix = new Mat(transform);
  const gridRect = (new Rect(0, 0, 1200, gm.pngRect.height > 1000 ? 1200 : 600)).applyMatrix(matrix);
  const inverseMatrix = matrix.getInverseMatrix();

  const worldPngRect = gm.pngRect.clone().applySansTranslate(matrix);
  const pngOffset = matrix.transformSansTranslate({ x: gm.pngRect.x, y: gm.pngRect.y });

  /** @type {Geomorph.GeomorphDataInstance} */
  const output = {
    ...gm,
    gmId,
    itemKey: `${gm.key}-[${transform}]`,

    transform,
    matrix,
    inverseMatrix,
    transformStyle: `matrix(${transform})`,
    pixiTransform: geom.gmTransformToPixi(transform, pngOffset),

    worldPngRect,
    gridRect,
    gmRoomDecor: instantiateRoomDecor(gm, gmId, matrix),

    toLocalCoords(worldPoint) {
      return output.inverseMatrix.transformPoint(Vect.from(worldPoint));
    },
    toWorldCoords(localPoint) {
      return output.matrix.transformPoint(Vect.from(localPoint));
    },
  };

  return output;
}

/**
 * @param {Pick<Geomorph.ParsedLayout, 'roomGraph' | 'rooms' | 'doors' | 'windows' | 'lightSrcs'>} gm
 * @return {Geomorph.LightThruConnector[]}
 */
export function computeLightThruConnectors(gm) {
  const lightPolys = computeLightPolygons(gm, true);
  /** Output will be stored here */
  const lightThrus = /** @type {Geomorph.LightThruConnector[]} */ ([]);

  /**
   * @param {{ id: number; poly: Geom.Poly; roomId: number; }} light 
   * @param {number} roomId 
   * @param {{ connectorIds: { type: 'door' | 'window'; id: number }[]; roomIds: number[]; lightThrus: Geomorph.LightThruConnector[] }} prev previous
   * @param {number} depth 
   */
  function depthFirstLightRects(light, roomId, prev, depth) {
    if (depth <= 0) {
      return;
    }
    /** Used to avoid revisiting rooms */
    const nextRoomIds = prev.roomIds.concat(roomId);
    let otherRoomId = -1;

    const succs = /** @type {(Graph.RoomGraphNodeDoor | Graph.RoomGraphNodeWindow)[]} */ (
      gm.roomGraph.getSuccs(gm.roomGraph.nodesArray[roomId])
    );

    for (const succ of succs) {
      const connectorPoly = (succ.type === 'door' ? gm.doors[succ.doorId] : gm.windows[succ.windowId]).poly;

      if (!Poly.intersect([connectorPoly], [light.poly]).length) {
        continue; // can have parallel doors where light only goes thru some
      } else if ((otherRoomId = getUnseenConnectorRoomId(succ.type === 'door' ? gm.doors[succ.doorId] : gm.windows[succ.windowId], nextRoomIds)) === -1) {
        continue;
      }

      const otherRoomPoly = gm.rooms[otherRoomId];
      const outsetDoorPoly = geom.createOutset(connectorPoly, 1)[0];
      const otherRoomIntersection = Poly.intersect([otherRoomPoly], [light.poly]).filter(
        // otherRoomIntersection can have disjoint pieces: choose right one
        poly => Poly.intersect([outsetDoorPoly], [poly]).length
      );
      if (!otherRoomIntersection.length) {
        continue;
      }

      lightThrus.push({
        key: succ.type === 'door' ? `door${succ.doorId}@light${light.id}` : `window${succ.windowId}@light${light.id}`,
        doorId: succ.type === 'door' ? succ.doorId : -1,
        windowId: succ.type === 'window' ? succ.windowId : -1,
        lightId: light.id,
        rect: otherRoomIntersection[0].rect.precision(0),
        // Needed for diagonal doors, but we can start using it instead of rect
        poly: otherRoomIntersection[0],
        srcRoomId: light.roomId,
        preConnectors: prev.connectorIds.slice(),
        postConnectors: [], // computed directly below
      });
      succ.type === 'door' && prev.lightThrus.forEach(prevLightRect => prevLightRect.postConnectors.push({ type: 'door', id: succ.doorId }));
      const nextPrev = {
        connectorIds: prev.connectorIds.concat(succ.type === 'door' ? { type: 'door', id: succ.doorId} : { type: 'window', id: succ.windowId}),
        roomIds: nextRoomIds,
        lightThrus: prev.lightThrus.concat(lightThrus.slice(-1)),
      };
      depthFirstLightRects(light, otherRoomId, nextPrev, --depth);
    }
  }

  lightPolys.forEach((lightPoly, lightId) => {
    const { roomId } = gm.lightSrcs[lightId];
    const light = { id: lightId, roomId, poly: lightPoly.clone().precision(2) }; // 🚧 broke sans precision
    depthFirstLightRects(light, roomId, { connectorIds: [], roomIds: [], lightThrus: [] }, 3);
  });

  for (let i = 0; i < lightThrus.length; i++) {
    for (let j = i + 1; j < lightThrus.length; j++) {
      const [ri, rj] = [i, j].map(k => lightThrus[k]);
      if ((ri.lightId !== rj.lightId) && ri.rect.intersects(rj.rect)) {
        warn(`computeLightDoorRects: light rects for lights ${ri.lightId}, ${rj.lightId} should not be intersecting`);
      }
    }
  }

  return lightThrus;
}

/**
 * Aligned to geomorph `lightSrcs`.
 * @param {Pick<Geomorph.ParsedLayout, 'lightSrcs' | 'rooms' | 'doors' | 'windows'>} gm
 */
export function computeLightPolygons(gm, intersectWithCircle = false) {
  try {
    const lightSources = gm.lightSrcs;
    /** More than one polygon can happen e.g. Geomorph 102 */
    const allRoomsAndDoors = Poly.union([
      ...gm.rooms,
      ...getNormalizedDoorPolys(gm.doors), // must extrude hull doors
      ...gm.windows.map(x => x.poly),
    ]);

    const lightPolys = lightSources.map(({ position, distance: _ }, i) => {
      const exterior = allRoomsAndDoors.find(poly => poly.contains(position));
      if (exterior) {
        // 🚧 compute associated door rects and warn if needed
        return geom.lightPolygon({
          position,
          range: 2000, // Must use large range (exceeding geomorph bounds) for good polygon
          exterior,
        });
      } else {
        console.error(`empty light ${i} (${JSON.stringify(position)}): no exterior found`);
        return new Poly;
      }
    });

  
    if (intersectWithCircle) {

      const restrictedLightPolys = lightPolys.map((lightPoly, lightId) => {
        const { distance = defaultLightDistance, position } = gm.lightSrcs[lightId];
        const circlePoly = Poly.circle(position, distance, 30);
        return (Poly.intersect([circlePoly], [lightPoly])[0] ?? new Poly).precision(2);
      });

      for (let i = 0; i < restrictedLightPolys.length; i++) {
        for (let j = i + 1; j < restrictedLightPolys.length; j++) {
          const [pi, pj] = [i, j].map(k => restrictedLightPolys[k]);
          if (pi.rect.intersects(pj.rect) && Poly.intersect([pi], [pj]).length) {
            warn(`computeLightPolygons: light polys ${i}, ${j} should not be intersecting`);
          }
        }
      }
      
      return restrictedLightPolys;
    } else {
      return lightPolys;
    }
  } catch (e) {
    console.error('computeLightPolygons failed', e);
    return [];
  }
}

/**
 * @param {Geomorph.ConnectorRect} connector 
 * @param {number} srcRoomId Must lie in @see connector roomIds
 * @param {number} lightOffset In direction from @see srcRoomId through @see connector 
 */
export function computeViewPosition(connector, srcRoomId, lightOffset) {
  const roomSign = connector.roomIds[0] === srcRoomId ? 1 : -1;
  return connector.poly.center.addScaledVector(connector.normal, lightOffset * roomSign);
}

/**
 * - Convert triangulation into a nav zone,
 *   as in npm module `three-pathfinding`.
 * - Compute doorId -> navNodeId mapping
 * - Compute roomId -> navNodeId mapping
 * - Verify various constraints
 * @param {Geom.TriangulationJson} navDecomp
 * @param {Geomorph.ConnectorRect[]} doors
 * @param {Geom.Poly[]} rooms
 * @returns {Nav.ZoneWithMeta}
 */
export function buildZoneWithMeta(navDecomp, doors, rooms) {

  // The main calculation
  const navZone = Builder.buildZone(navDecomp);

  /**
   * - Multiple navZone groups are possible e.g. 102. 
   * - If invoked browser-side, no triangulation hence no navNodes
   */
  const navNodes = navZone.groups.flatMap(x => x) || [];

  /**
   * A navNodeId is an index into `navNodes` i.e. we flatten groups.
   * Consequently we need to offset neighbours of 2nd and later groups.
   * The portals and vertexIds are derived from the triangulation,
   * so they are already correct.
   */
  let groupOffset = navZone.groups[0].length;
  for (const group of navZone.groups.slice(1)) {
    group.forEach(node => {
      node.id += groupOffset;
      node.neighbours = node.neighbours.map(id => id + groupOffset);
    });
    groupOffset += group.length;
  }

  /**
   * We'll construct `doorNodeIds` and `roomNodeIds` i.e.
   * - navNode has doorId if navNode.index in doorNodeIds[doorId]
   * - navNode has roomId if navNode.index in roomNodeIds[doorId]
   */

  /**
   * A nav node is associated with at most one doorId,
   * when it intersects the respective door's line segment.
   * Actually, there should be exactly two nav nodes for any doorId.
   */
  const doorNodeIds = /** @type {number[][]} */ ([]);
  /**
   * A nav node is associated with at most one roomId i.e.
   * when some vertex lies inside the room.
   */
  const roomNodeIds = /** @type {number[][]} */ ([]);

  // Technically could be smaller by checking triangle intersects each grid square
  const gridToNodeIds = navNodes.reduce((agg, node) => {
    const rect = Rect.fromPoints(...node.vertexIds.map(id => navZone.vertices[id]));
    addToNavNodeGrid(node.id, rect, agg);
    return agg;
  }, /** @type {Nav.ZoneWithMeta['gridToNodeIds']} */  ({}));

  /**
   * We'll also verify that:
   * (a) every nav node has either a doorId or a roomId.
   * (b) every nav node has at most one doorId.
   * (c) every doorId is related to exactly two nav nodes.
   * (d) every nav node without a doorId has at most one roomId.
   *
   * There may be overlap i.e. the two triangles corresponding
   * to a particular doorId may overlap the rooms they connect.
   */
  const nodeDoorIds = navNodes.map(_ => /** @type {number[]} */ ([]));
  const nodeRoomIds = navNodes.map(_ => /** @type {number[]} */ ([]));

  // Construct doorNodeIds
  const tempTri = new Poly;
  doors.forEach(({ seg: [u, v] }, doorId) => {
    doorNodeIds[doorId] = [];
    navNodes.forEach((node, nodeId) => {
      tempTri.outline = node.vertexIds.map(vid => Vect.from(navZone.vertices[vid]));
      if (geom.lineSegIntersectsPolygon(u, v, tempTri)) {
        doorNodeIds[doorId].push(nodeId);
        if (nodeDoorIds[nodeId].push(doorId) > 1) {
          warn('nav node', JSON.stringify(node), 'has multiple doorIds', nodeDoorIds[nodeId]);
        }
      }
    });
  });

  const malformedDoorIds = doorNodeIds.flatMap((x, i) => x.length === 2 ? [] : i);
  if (malformedDoorIds.length) {
    warn('doorIds lacking exactly 2 nav nodes:', malformedDoorIds, `(resp. counts ${malformedDoorIds.map(i => doorNodeIds[i].length)})`);
  }

  // Construct roomNodeIds
  rooms.forEach((poly, roomId) => {
    roomNodeIds[roomId] = [];
    navNodes.forEach((node, nodeId) => {
      // if (node.vertexIds.filter(id => poly.outlineContains(navZone.vertices[id])).length >= 2) {
      // if (node.vertexIds.some(id => poly.outlineContains(navZone.vertices[id]))) {
      /**
       * ISSUE with `poly.outlineContains` in gm 101 room 10/14
       * TODO open issue at https://github.com/davidfig/intersects
       */
      if (node.vertexIds.some(id => poly.contains(navZone.vertices[id]))) {
        roomNodeIds[roomId].push(nodeId);
        if (
          nodeRoomIds[nodeId].push(roomId) > 1
          && nodeDoorIds[nodeId].length === 0 // nodes with a doorId may have 2 roomIds
        ) {
          warn('nav node', node.id, 'has no doorId and multiple roomIds', nodeRoomIds[nodeId]);
        }
      }
    });
  });
  
  const nodesSansBothIds = nodeRoomIds.flatMap((roomIds, nodeId) => roomIds.length ? [] : nodeDoorIds[nodeId].length ? [] : nodeId);
  if (nodesSansBothIds.length) {
    warn('nav nodes have neither roomId nor doorId', nodesSansBothIds);
  }

  return {
    ...navZone,
    doorNodeIds,
    roomNodeIds,
    gridSize: navNodeGridSize,
    gridToNodeIds,
  };
}

/** @type {Record<Geomorph.GeomorphKey, true>} */
const fromGmKey = {
  "g-101--multipurpose": true,
  'g-102--research-deck': true,
  'g-103--cargo-bay': true,
  'g-301--bridge': true,
  'g-302--xboat-repair-bay': true,
  'g-303--passenger-deck': true,
};

export const geomorphKeys = keys(fromGmKey);

/**
 * @param {Geomorph.GeomorphKey} layoutKey
 * @returns Live path to asset
 */
export function geomorphJsonPath(layoutKey) {
  return `/assets/geomorph/${layoutKey}.json`
}

/**
 * @param {Geomorph.GeomorphKey} layoutKey
 * @returns Live path to asset (webp or png)
 */
export function geomorphPngPath(layoutKey, suffix = '') {
  return `/assets/geomorph/${layoutKey}${suffix ? `.${suffix}` : ''}.${
    supportsWebp ? 'webp' : 'png'
  }`
}

export const labelMeta = {
  sizePx: 8,
  /** Text has no tail if it doesn't contain g, j, p, q or y */
  noTailPx: 10,
  font: `${8}px 'Courier new'`,
  padX: 4,
  padY: 2,
};

/**
 * @param {{ meta: Geomorph.PointMeta; poly: Geom.Poly }[]} singles 
 * @param {...(string | string[])} tagOrTags Restrict to singles with any/all of these tags
 */
export function singlesToPolys(singles, ...tagOrTags) {
  return filterSingles(singles, ...tagOrTags).map(x => x.poly);
}

/**
 * @template {Geom.Poly | Geom.GeoJsonPolygon} T
 * @param {{ meta: Geomorph.PointMeta; poly: T }[]} singles 
 * @param {...(string | string[])} tagOrTags Restrict to singles with any/all of these tags
 */
export function filterSingles(singles, ...tagOrTags) {
  return singles.filter(x => tagOrTags.some(spec =>
    Array.isArray(spec)
      ? spec.every(tag => x.meta[tag] === true)
      : x.meta[spec] === true
    )
  );
}

/**
 * @param {CanvasRenderingContext2D} ctxt 
 * @param {Nav.Zone} navZone 
 */
 export function drawTriangulation(ctxt, navZone) {
	const { groups, vertices } = navZone;
	for (const [index, tris] of groups.entries()) {
		if (index > 0) {
			warn(`drawTriangulation: drawing extra navZone group ${index} with ${tris.length} tris`);
			// continue;
		}
		for (const { vertexIds } of tris) {
			ctxt.beginPath();
			fillRing(ctxt, vertexIds.map(i => vertices[i]), false);
			ctxt.stroke();
		}
	}
}

/**
 * @param {string[]} tags
 * @param {Geomorph.PointMeta} baseMeta 
 */
export function tagsToMeta(tags, baseMeta) {
  return tags.reduce((meta, tag) => {
    const eqIndex = tag.indexOf('=');
    if (eqIndex > -1) {
      meta[tag.slice(0, eqIndex)] = parseJsArg(tag.slice(eqIndex + 1));
    } else {
      meta[tag] = true; // Omit tags `foo=bar`
    }
    return meta;
  }, baseMeta);
}

/**
 * @param {Geomorph.PointMeta} meta 
 * @returns {string[]}
 */
export function metaToTags(meta) {
  return Object.keys(meta).filter(key => meta[key] === true);
}

//#endregion

//#region decor

/**
 * @param {NPC.DecorDef} decor 
 * @param {Geom.VectJson} point 
 * @returns {boolean}
 */
export function decorContainsPoint(decor, point) {
  switch (decor.type) {
    case 'circle':
      return tempVect.copy(point).distanceTo(decor.center) <= decor.radius;
    case 'point':
      return tempVect.copy(point).equals(decor);
    case 'rect':
      return geom.outlineContains(decor.derivedPoly?.outline ?? [], point);
    default:
      throw testNever(decor);
  }
}

/**
 * @param {NPC.DecorDef} decor 
 * @returns {NPC.DecorRef} 
 */
export function decorToRef(decor) {
  return {
    decorKey: decor.key,
    type: decor.type,
    meta: decor.meta,
  };
}

/**
 * Ensure decor.meta.{gmId,roomId} (possibly null)
 * @param {NPC.DecorDef} decor
 * @param {Graph.GmGraph} gmGraph
 */
export function ensureDecorMetaGmRoomId(decor, gmGraph) {
  // Safety e.g. decor may arise from untyped CLI
  !decor.meta && Object.assign(decor, { meta: {} });

  if (!(decor.meta.gmId >= 0 && decor.meta.roomId >= 0)) {
    const decorOrigin = getDecorOrigin(decor);
    const gmRoomId = gmGraph.findRoomContaining(decorOrigin);
    if (!gmRoomId)
      throw new Error(`decor origin must reside in some room: ${JSON.stringify(decor)}`);
    Object.assign(decor.meta, gmRoomId);
  }
  return decor.meta;
}

/**
 * 🚧 could pre-compute, setting `meta.icon`
 * @param {Geomorph.PointMeta} meta 
 * @returns {NPC.DecorPointClassKey}
 */
export function getDecorClassByMeta(meta) {
  return (
    meta.stand && 'standing-man' || 
    meta.sit && 'sitting-man' || 
    meta.lie && 'lying-man' || 
    meta.label && 'info' || 
    meta.cpu && 'computer' || 
    'road-works'
  );
}

/**
 * Each decor lies in precisely one room, this being determined by its center.
 * We compute this origin without using `derivedBounds`.
 * @param {NPC.DecorDef} decor 
 * @returns {Geom.VectJson}
 */
export function getDecorOrigin(decor) {
  switch (decor.type) {
    case 'circle':
      return decor.center;
    case 'point':
      return { x: decor.x, y: decor.y };
    case 'rect':
      return geom.getAngledRectCenter({ baseRect: decor, angle: decor.angle ?? 0 }).json;
    default: throw testNever(decor);
  }
}

/**
 * @param {NPC.DecorDef} decor 
 */
export function getDecorRect(decor) {
  return /** @type {Geom.Rect} */ (decor.derivedBounds);
}

/**
 * @type {(prefix: 'symbol' | 'door', gmId: number, roomId: number) => string}
 */
export function getLocalDecorPrefix(prefix, gmId, roomId) {
  return `${prefix}-g${gmId}r${roomId}`;
}

/**
 * @param {NPC.DecorDef} d 
 * @param {{ key: string; meta: Geomorph.PointMeta; matrix: Mat }} ctxt 
 * @returns {NPC.DecorDef}
 */
function instantiateLocalDecor(d, ctxt) {
  const key = ctxt.key;

  if (d.type === 'rect') {
    // 🚧 better way of computing transformed angledRect?
    const transformedPoly = assertDefined(d.derivedPoly).clone().applyMatrix(ctxt.matrix).fixOrientation();
    const { angle, baseRect } = geom.polyToAngledRect(transformedPoly);
    return {
      ...d,
      ...baseRect,
      angle,
      derivedPoly: transformedPoly,
      derivedBounds: transformedPoly.rect,
      key,
      meta: { ...d.meta, ...ctxt.meta },
    };
  } else if (d.type === 'circle') {
    return {
      ...d,
      key,
      center: ctxt.matrix.transformPoint({ ...d.center }),
      meta: { ...d.meta, ...ctxt.meta },
    };
  } else if (d.type === 'point') {
    return {
      ...d,
      key,
      ...ctxt.matrix.transformPoint({ x: d.x, y: d.y }),
      meta: {
        ...d.meta,
        ...ctxt.meta,
        // 🚧 cache?
        ...typeof d.meta.orient === 'number' && {
          orient: Math.round(ctxt.matrix.transformAngle(d.meta.orient * (Math.PI / 180)) * (180 / Math.PI))
        },
        ...typeof d.meta.angle === 'number' && {
          angle: Math.round(ctxt.matrix.transformAngle(d.meta.angle * (Math.PI / 180)) * (180 / Math.PI)),
        },
        ui: true,
      },
    };
  } else {
    throw testNever(d, { suffix: 'instantiateDecor' });
  }
};

/**
 * @param {Geomorph.GeomorphData} gm 
 * @param {number} gmId 
 * @param {Geom.Mat} matrix 
 * @returns {NPC.RoomDecorCache[]}
 */
export function instantiateRoomDecor(gm, gmId, matrix) {
  const output = /** @type {NPC.RoomDecorCache[]} */ ([]);
  gm.rooms.forEach((_room, roomId) => {
    const { [roomId]: base } = gm.roomDecor;
    const gmRoomId = { gmId, roomId };
    
    /** @type {NPC.RoomDecorCache} */
    const atRoom = output[roomId] = {
      symbol: base.symbol.map((d, localId) => instantiateLocalDecor(d, { key: `${getLocalDecorPrefix('symbol', gmId, roomId)}-${localId}`, meta: gmRoomId, matrix })),
      door: base.door.map((d, localId) => instantiateLocalDecor(d, { key: `${getLocalDecorPrefix('door', gmId, roomId)}-${localId}`, meta: gmRoomId, matrix })),
      decor: {},
      colliders: [],
      points: [],
    };

    atRoom.door.concat(atRoom.symbol).forEach(d => {
      normalizeDecor(d);
      atRoom.decor[d.key] = d;
      isCollidable(d) && atRoom.colliders.push(d);
      isDecorPoint(d) && atRoom.points.push(d);
    });
  });
  return output;
}

/**
 * @param {NPC.DecorDef} decor
 * @return {decor is NPC.DecorCollidable}
 */
export function isCollidable(decor) {
  return decor.type === 'circle' || decor.type === 'rect';
}

/**
 * @param {NPC.DecorDef} decor
 * @return {decor is NPC.DecorPoint}
 */
export function isDecorPoint(decor) {
  return decor.type === 'point';
}

/**
 * Assume `d.meta` is a gmRoomId.
 * @param {NPC.DecorDef} d 
 * @returns {void}
 */
export function normalizeDecor(d) {
  // Extend meta with tags from def; normalize
  d.tags?.forEach(tag => d.meta[tag] = true);
  d.tags = metaToTags(d.meta);

  switch (d.type) {
    case 'circle': {
      // d.derivedPoly = Poly.circle(d.center, d.radius, 32);
      const radius = d.radius + 2;
      d.derivedBounds = new Rect(d.center.x - radius, d.center.y - radius, 2 * radius, 2 * radius);
      break;
    }
    case 'rect':
      // rect needn't be aabb
      d.derivedPoly = Poly.fromAngledRect({ angle: d.angle ?? 0, baseRect: d });
      d.derivedBounds = d.derivedPoly.rect.outset(2);
      break;
    case 'point': {
      const radius = decorIconRadius + 2;
      // Overwritten if d.meta.width numeric
      d.derivedBounds = new Rect(d.x - radius, d.y - radius, 2 * radius, 2 * radius);
      break;
    }
    default:
      throw testNever(d);
  }
}

/**
 * @param {Geomorph.SvgGroupWithTags<Poly>} svgSingle
 * @param {number} singleIndex
 * @param {Geomorph.PointMeta<Geomorph.GmRoomId>} baseMeta Assumed fresh
 * @returns {NPC.DecorDef}
 */
export function singleToDecor(svgSingle, singleIndex, baseMeta) {
  const p = svgSingle.poly.center;
  const origPoly = svgSingle.poly;
  const meta = Object.assign(baseMeta, svgSingle.meta);

  if (meta.rect) {
    const { baseRect, angle } = geom.polyToAngledRect(origPoly);
    return {
      type: 'rect',
      // ℹ️ key will be overridden upon instantiation
      key: `${singleIndex}`,
      meta,
      x: baseRect.x,
      y: baseRect.y,
      width: baseRect.width,
      height: baseRect.height,
      angle,
      // ℹ️ Needed by api.npcs.updateLocalDecor
      // ℹ️ Don't know how to transform angledRect
      derivedPoly: origPoly.clone(),
    };
  } else if (meta.circle) {
    const { center, width } = origPoly.rect;
    return {
      type: 'circle',
      key: `${singleIndex}`,
      meta,
      center,
      radius: width / 2,
    };
  } else {// Assume point (we do not support DecorPath)
    return {
      type: 'point',
      key: `${singleIndex}`,
      meta,
      x: p.x,
      y: p.y,
    };
  }
}

/**
 * We don't verify `meta` yet.
 * @param {NPC.DecorDef} [input]
 * @returns {boolean}
 */
export function verifyDecor(input) {
  if (!input) {
    return false;
  }
  switch (input.type) {
    case 'circle':
      return Vect.isVectJson(input.center) && typeof input.radius === 'number';
    case 'point':
      // We permit `input.tags` and `input.meta` to be undefined
      return Vect.isVectJson(input);
    case 'rect':
      return [input.x, input.y, input.width, input.height].every(x => Number.isFinite(x));
    default:
      throw testNever(input, { override: `decor has unrecognised type: ${JSON.stringify(input)}` });
  }
}


//#endregion

//#region grid

/**
 * @param {Geomorph.UseGeomorphsDefItem[]} gmDefs 
 */
export function computeHitTestGrid(gmDefs) {
  /** @type {Geomorph.HitTestGlobal} */
  const output =  { gridDim: gmGridSize, ctxts: [], grid: {} };
  const rect = new Rect;
  const mat = new Mat;
  gmDefs.forEach(({ gmKey, transform }) => {
    /**
     * Assume geomorph is either "standard" (1200 * 1200) or "edge" (1200 * 600).
     * We may support corner geomorphs and others in the future.
     */
    rect.set(0, 0, gmGridSize * 2, gmGridSize * (isEdgeGeomorph(gmKey) ? 1 : 2));
    transform && rect.applyMatrix(mat.feedFromArray(transform));
    const ctxt = imageService.getCtxt([rect.width, rect.height]);
    ctxt.imageSmoothingEnabled = false;
    output.ctxts.push(ctxt);
    (output.grid[rect.x / gmGridSize] ??= {})[rect.y / gmGridSize] = [ctxt];
  });
  return {
    output,
    cleanup: () => imageService.freeCtxts(...output.ctxts),
  };
}

/**
 * @param {number} item Nav node id
 * @param {Geom.RectJson} rect Rectangle corresponding to item
 * @param {Geomorph.Grid<number>} grid 
 */
function addToNavNodeGrid(item, rect, grid) {
  const min = coordToNavNodeGrid(rect.x, rect.y);
  const max = coordToNavNodeGrid(rect.x + rect.width, rect.y + rect.height);
  // const max = coordToNavNodeGridSupremum(rect.x + rect.width, rect.y + rect.height);
  for (let i = min.x; i <= max.x; i++)
    for (let j = min.y; j <= max.y; j++)
      ((grid[i] ??= {})[j] ??= []).push(item);
}

/**
 * @param {number} item Room id (relative to some geomorph)
 * @param {Geom.RectJson} rect Aabb of room polygon
 * @param {Geomorph.Grid<number>} grid 
 */
function addToRoomGrid(item, rect, grid) {
  const min = coordToRoomGrid(rect.x, rect.y);
  const max = coordToRoomGrid(rect.x + rect.width, rect.y + rect.height);
  for (let i = min.x; i <= max.x; i++)
    for (let j = min.y; j <= max.y; j++)
      ((grid[i] ??= {})[j] ??= []).push(item);
}

/**
 * @param {NPC.DecorDef} item 
 * @param {NPC.DecorGrid} grid 
 */
export function addToDecorGrid(item, grid) {
  const rect = getDecorRect(item);
  const min = coordToDecorGrid(rect.x, rect.y);
  const max = coordToDecorGrid(rect.x + rect.width, rect.y + rect.height);
  // const max = coordToDecorGridSupremum(rect.x + rect.width, rect.y + rect.height);
  item.meta.gridMin = min; // For easy deletion
  item.meta.gridMax = max;
  for (let i = min.x; i <= max.x; i++)
    for (let j = min.y; j <= max.y; j++)
      ((grid[i] ??= [])[j] ??= { points: new Set, colliders: new Set })[
        isDecorPoint(item) ? 'points' : 'colliders'
      ].add(/** @type {*} */ (item));
}

/**
 * @param {NPC.DecorDef} d 
 * @param {NPC.DecorGrid} grid 
 */
export function removeFromDecorGrid(d, grid) {
  const min = /** @type {Geom.VectJson} */ (d.meta.gridMin);
  const max = /** @type {Geom.VectJson} */ (d.meta.gridMax);
  for (let i = min.x; i <= max.x; i++)
    for (let j = min.y; j <= max.y; j++)
      grid[i][j]?.[
        isDecorPoint(d) ? 'points' : 'colliders'
      ].delete(/** @type {*} */ (d))
}

/** @type {Set<NPC.DecorCollidable>} */
const foundDecor = new Set;

/**
 * - Returns colliders in same tiles as line
 * - Does not filter by gmRoomId
 * @param {Geom.Vect} p 
 * @param {Geom.Vect} q 
 * @param {NPC.DecorGrid} grid
 * @returns {NPC.DecorCollidable[]}
 */
export function queryDecorGridLine(p, q, grid) {  
  const tau = tempVect.copy(q).sub(p);
  /** Single horizontal step */
  const dx = Math.sign(tau.x);
  /** Single vertical step */
  const dy = Math.sign(tau.y);

  /** `p`'s grid coords */
  const gp = coordToDecorGrid(p.x, p.y);
  // /** `q`'s grid coords */
  // const gq = coordToDecorGrid(q.x, q.y);

  foundDecor.clear();
  grid[gp.x]?.[gp.y]?.colliders.forEach(d => foundDecor.add(d));
  if (dx !== 0 || dy !== 0) {
    /**
     * Those λ ≥ 0 s.t. p + λ.tau on a vertical grid line.
     * Initially minimum such, then the subsequent ones.
     * - General form λ := ((decorGridSize * dx * n) - p.x) / tau.x where n in ℤ
     * - λ ≥ 0 yields n := Math.ceil(± p.x / decorGridSize) 
     */
    let lambdaV = tau.x === 0 ? Infinity : tau.x > 0
        ? ((decorGridSize *  1 * Math.ceil( p.x / decorGridSize)) - p.x) / tau.x
        : ((decorGridSize * -1 * Math.ceil(-p.x / decorGridSize)) - p.x) / tau.x;
    /**
     * Those λ ≥ 0 s.t. p + λ.tau on a horizontal grid line.
     * Initially the minimum such, then the subsequent ones.
     * - General form λ := ((decorGridSize * dy * n) - p.y) / tau.y where n in ℤ
     * - λ ≥ 0 yields n := Math.ceil(± p.y / decorGridSize) 
     */
    let lambdaH = tau.y === 0 ? Infinity : tau.y > 0
      ? ((decorGridSize *  1 * Math.ceil( p.y / decorGridSize)) - p.y) / tau.y
      : ((decorGridSize * -1 * Math.ceil(-p.y / decorGridSize)) - p.y) / tau.y;
    
    let cx = gp.x, cy = gp.y;

    do {
      if (lambdaV <= lambdaH) {
        cx += dx; // Hit vert grid line 1st, so move horizontal
        lambdaV += (decorGridSize * dx) / tau.x; // Next vert line
      } else {
        cy += dy; // Hit horizontal 1st, so move vert
        lambdaH += (decorGridSize * dy) / tau.y; // Next horizontal line
      }
      grid[cx]?.[cy]?.colliders.forEach(d => foundDecor.add(d));

      // 🤔 (cx, cy) may not reach `max` in diagonal case?
      // } while ((cx !== max.x) && (cy !== max.y))
    } while (Math.min(lambdaH, lambdaV) <= 1)
  }

  return Array.from(foundDecor);
}

/**
 * - Returns colliders and points intersecting rect
 * - Does not filter by gmRoomId
 * @param {Geom.Rect} rect 
 * @param {NPC.DecorGrid} grid
 */
export function queryDecorGridIntersect(rect, grid) {
  const colliders = /** @type {{ [decorKey: string]: NPC.DecorDef }} */ ({});
  const points = /** @type {{ [decorKey: string]: NPC.DecorDef }} */ ({});
  const min = coordToDecorGrid(rect.x, rect.y);
  const max = coordToDecorGrid(rect.x + rect.width, rect.y + rect.height);
  /** @type {NPC.DecorGrid[*][*]} */ let tile;
  for (let i = min.x; i <= max.x; i++)
    for (let j = min.y; j <= max.y; j++) {
      tile = grid[i]?.[j];
      tile.colliders.forEach(x => rect.intersects(getDecorRect(x)) && (colliders[x.key] = x));
      tile.points.forEach(x => rect.intersects(getDecorRect(x)) && (points[x.key] = x));
    }
  return { colliders, points };
}

/**
 * @param {number} x
 * @param {number} y
 */
export function coordToDecorGrid(x, y) {
  return { x: Math.floor(x / decorGridSize), y: Math.floor(y / decorGridSize) };
}

/**
 * @param {number} x
 * @param {number} y
 */
export function coordToNavNodeGrid(x, y) {
  return { x: Math.floor(x / navNodeGridSize), y: Math.floor(y / navNodeGridSize) };
}

/**
 * @param {number} x
 * @param {number} y
 */
export function coordToRoomGrid(x, y) {
  return { x: Math.floor(x / roomGridSize), y: Math.floor(y / roomGridSize) };
}

//#endregion

const tempVect = new Vect;
