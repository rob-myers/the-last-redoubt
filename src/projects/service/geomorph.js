/* eslint-disable no-unused-expressions */
import cheerio, { Element } from 'cheerio';
import { createCanvas } from 'canvas';
import { assertDefined, testNever } from './generic';
import { error, info, warn } from './log';
import { defaultLightDistance, hullDoorOutset, hullOutset, obstacleOutset, precision, svgSymbolTag, wallOutset } from './const';
import { Poly, Rect, Mat, Vect } from '../geom';
import { extractGeomsAt, hasTitle } from './cheerio';
import { geom } from './geom';
import { roomGraphClass } from '../graph/room-graph';
import { Builder } from '../pathfinding/Builder';
import { fillRing, supportsWebp } from "../service/dom";

/**
 * Create a layout given a definition and all symbols.
 * Can run in browser or on server.
 * @param {CreateLayoutOpts} opts
 * @returns {Promise<Geomorph.ParsedLayout>}
 */
export async function createLayout(opts) {
  const m = new Mat;
  /** @type {Geomorph.ParsedLayout['groups']} */
  const groups = { obstacles: [], singles: [], walls: [] };

  // Compute `groups`
  opts.def.items.forEach((item, i) => {
    m.feedFromArray(item.transform || [1, 0, 0, 1, 0, 0]);
    const { singles, obstacles, walls, hull } = opts.lookup[item.symbol];
    if (i) {
      /**
       * Starship symbol PNGs are 5 times larger than geomorph PNGs.
       * We skip 1st item i.e. hull, which corresponds to a geomorph PNG.
       */
      m.a *= 0.2,
      m.b *= 0.2,
      m.c *= 0.2,
      m.d *= 0.2;
    }
    // Transform singles (restricting doors/walls by item.tags)
    // Room orientation tags permit decoding orient-{deg} tags later
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
      });
    groups.singles.push(...restrictedSingles);
    groups.obstacles.push(...obstacles.map(({ meta, poly }) =>
      ({
        meta,
        poly: poly.clone().cleanFinalReps().applyMatrix(m).precision(precision),
      })
    ));

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
  });

  // Ensure well-signed polygons
  groups.singles.forEach(({ poly }) => poly.fixOrientation().precision(precision));
  groups.obstacles.forEach(({ poly }) => poly.fixOrientation().precision(precision));
  groups.walls.forEach((poly) => poly.fixOrientation().precision(precision));
  
  const symbols = opts.def.items.map(x => opts.lookup[x.symbol]);
  const hullSym = symbols[0];
  const hullOutline = hullSym.hull.map(x => x.clone().removeHoles()); // Not transformed
  const windowPolys = singlesToPolys(groups.singles, 'window');
  /** We keep a reference to uncut walls (group.walls overwritten below) */
  const uncutWalls = groups.walls;

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
      const tags = Object.keys(meta);
      const center = poly.rect.center.precision(precision).json;
      // Subsequent tags make up label
      // 🚧 label=foo
      const text = tags.slice(tags.indexOf('label') + 1).join(' ');
      const noTail = !text.match(/[gjpqy]/);
      const dim = { width: measurer.measureText(text).width, height: noTail ? labelMeta.noTailPx : labelMeta.sizePx };
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

  /** Sometimes large disjoint nav areas must be discarded  */
  const ignoreNavPoints = groups.singles
    .filter(x => x.meta['ignore-nav']).map(x => x.poly.center)
  ;

  /**
   * Navigation polygon obtained by cutting outset walls and outset obstacles
   * from `hullOutline`, thereby creating doorways (including doors).
   * We also discard polygons intersecting ignoreNavPoints,
   * or if they are deemed too small.
   */
  const navPolyWithDoors = Poly.cutOut(
    [ // Non-unioned walls avoids outset issue (self-intersection)
      ...unjoinedWalls.flatMap(x => geom.createOutset(x, wallOutset)),
      ...groups.obstacles.flatMap(x => geom.createOutset(x.poly, obstacleOutset)),
    ],
    hullOutline,
  ).map(
    x => x.cleanFinalReps().fixOrientation().precision(precision)
  ).filter(poly => 
    !ignoreNavPoints.some(p => poly.contains(p))
    && poly.rect.area > 20 * 20 // also ignore small areas
  );

  /** Intersection of each door (angled rect) with navPoly */
  const navDoorPolys = doorPolys
    .flatMap(doorPoly => Poly.intersect([doorPoly], navPolyWithDoors))
    .map(x => x.cleanFinalReps())
  ;
  /** Navigation polygon without doors */
  const navPolySansDoors = Poly.cutOut(doorPolys, navPolyWithDoors);

  /**
   * Apply Triangle triangulation library to `navPolySansDoors`.
   * - We add the doors back manually further below
   * - Currently triangle-wasm runs server-side only
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
   * - We assume well-formedness i.e. exactly 2 edges already present
   *   in the triangulation. If not we warn and skip the door.
   * - We do not ensure the sign of these triangles (e.g. clockwise)
   */
  const tempVect = new Vect;
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
      roomId: findRoomIdContaining(rooms, poly.center),
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

  /** @type {Geomorph.ParsedLayout} */
  const output = {
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
    lightRects: [], // Computed below
    floorHighlightIds,
    roomSurfaceIds,
    
    hullPoly: hullSym.hull.map(x => x.clone()),
    hullTop: Poly.cutOut(doorPolys.concat(windowPolys), hullSym.hull),
    hullRect,
  
    items: symbols.map(/** @returns {Geomorph.ParsedLayout['items'][0]} */  (sym, i) => ({
      key: sym.key,
      // `/assets/...` is a live URL, and also a dev env path if inside `/static`
      pngHref: i ? `/assets/symbol/${sym.key}.png` : `/assets/debug/${opts.def.key}.png`,
      pngRect: sym.pngRect,
      transformArray: opts.def.items[i].transform,
      transform: opts.def.items[i].transform ? `matrix(${opts.def.items[i].transform})` : undefined,
    })),
  };

  output.lightRects = computeLightDoorRects(output);

  return output;
}

/**
 * @typedef CreateLayoutOpts
 * @type {object}
 * @property {Geomorph.LayoutDef} def
 * @property {Geomorph.SymbolLookup} lookup
 * @property {null | import('./triangle').TriangleService} triangleService
 * If the triangulation service is not provided, then e.g.
 * @see {Geomorph.ParsedLayout.navZone} is degenerate.
 */

/**
 * Some hull doors shouldn't be tagged,
 * e.g. the central and right one in geomorph 301.
 * They are not connectable to other geomorphs.
 * @param {Geomorph.ParsedConnectorRect} door 
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
 * @param {Geomorph.ParsedLayout['rooms']} rooms 
 * @param {Geom.VectJson} localPoint
 */
export function findRoomIdContaining(rooms, localPoint) {
  return rooms.findIndex(room => room.contains(localPoint)); 
}

/**
 * 🚧 currently unused, probably needs adaptation
 *
 * Find a stand point close to `target` in same room.
 * Assume the target `point` world coords, whereas stand points local to geomorph.
 * @param {{ point: Geom.VectJson; meta: Geomorph.PointMeta }} target
 * @param {Geomorph.GeomorphDataInstance} gm 
 * @param {number} [maxDistSqr]
 */
export function getCloseStandPoint({point, meta}, gm, maxDistSqr = Number.POSITIVE_INFINITY) {
  if (typeof meta.roomId !== 'number') {
    throw Error(`meta.roomId must be a number (${JSON.stringify({ point, meta })})`);
  }
  const localPoint = gm.inverseMatrix.transformPoint(Vect.from(point));
  const standPoints = gm.decor[meta.roomId].flatMap(p => p.type === 'point' && p.meta.stand && !localPoint.equals(p) && p || []);
  const closestStandPoint = geom.findClosestPoint(standPoints, localPoint, maxDistSqr);
  if (closestStandPoint === null) {
    throw Error(`nearby stand point not found (${gm.key}: ${JSON.stringify({ localPoint, meta })})`);
  }
  return gm.matrix.transformPoint(closestStandPoint);
}

/**
 * @param {Geomorph.ParsedConnectorRect} connector
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
export function getGmRoomKey(gmId, roomId) {
  return `g${gmId}-r${roomId}`;
}

/**
 * Hull door polys are outset along entry to e.g. ensure they intersect room.
 * @param {Geomorph.ParsedConnectorRect[]} doors
 * @returns {Geom.Poly[]}
 */
export function getNormalizedDoorPolys(doors) {
  return doors.map(door =>
    door.meta.hull ? outsetConnectorEntry(door, hullDoorOutset) : door.poly
  );
}

/**
 * Returns -1 if no unseen room id found.
 * @param {Geomorph.ParsedConnectorRect} connector
 * @param {number[]} seenRoomIds could be frontier array of bfs
 */
export function getUnseenConnectorRoomId(connector, seenRoomIds) {
  return connector.roomIds.find(id => id !== null && !seenRoomIds.includes(id)) ?? -1;
}

/**
 * @param {Geomorph.PointMeta} meta 
 * @param {Mat} roomTransformMatrix 
 */
function modifySinglesMeta(meta, roomTransformMatrix) {
  if (typeof meta.orient === 'number') {
    // orientation must reflect parent room's transformation
    const newDegrees = roomTransformMatrix.transformAngle(meta.orient * (Math.PI / 180)) * (180 / Math.PI);
    meta.orient = Math.round(newDegrees < 0 ? 360 + newDegrees : newDegrees);
  }
  return meta;
}

/**
 * Outset connector rect along entry normal.
 * @param {Geomorph.ParsedConnectorRect} connector
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
 * Is the connector aligned with horizontal or vertical axis?
 * @param {Geomorph.ParsedConnectorRect} connector 
 */
export function isConnectorOrthonormal(connector) {
  return connector.normal.x === 0 || connector.normal.y === 0;
}

/**
 * @param {Geomorph.ConnectorRectJson} x
 * @returns {Geomorph.ParsedConnectorRect}
 */
function parseConnectorRect(x) {
  const poly = Poly.from(x.poly);
  return {
    ...x,
    baseRect: Rect.fromJson(x.baseRect),
    poly: poly,
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
 * @returns {Geomorph.ParsedConnectorRect}
 */
 function singleToConnectorRect(single, rooms) {
  const { poly, meta } = single;
  const { angle, baseRect } = poly.outline.length === 4
    ? geom.polyToAngledRect(poly)
    // For curved windows we simply use aabb
    : { baseRect: poly.rect, angle: 0 };
  const [u, v] = geom.getAngledRectSeg({ angle, baseRect });
  const normal = v.clone().sub(u).rotate(Math.PI / 2).normalize();

  const doorEntryDelta = (Math.min(baseRect.width, baseRect.height)/2) + 0.05;
  const infront = poly.center.addScaledVector(normal, doorEntryDelta).precision(precision);
  const behind = poly.center.addScaledVector(normal, -doorEntryDelta).precision(precision);
  const moreInfront = infront.clone().addScaledVector(normal, hullDoorOutset);
  const moreBehind = behind.clone().addScaledVector(normal, -hullDoorOutset);

  /** @type {[null | number, null | number]} */
  const roomIds = rooms.reduce((agg, room, roomId) => {
    if (agg[0] === null && room.contains(moreInfront)) return [roomId, agg[1]];
    if (agg[1] === null && room.contains(moreBehind)) return [agg[0], roomId];
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
  };
}

/** @param {Geomorph.ParsedLayout} layout */
export function serializeLayout({
  def, groups,
  rooms, doors, windows, labels, navPoly, navZone, roomGraph,
  lightSrcs, lightRects, floorHighlightIds, roomSurfaceIds,
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
    lightRects: lightRects.map(x => ({
      ...x,
      rect: x.rect.json,
    })),
    floorHighlightIds,
    roomSurfaceIds,

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
  lightSrcs, lightRects, floorHighlightIds, roomSurfaceIds,
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
    lightRects: lightRects.map(x => ({
      ...x,
      rect: Rect.fromJson(x.rect),
    })),
    floorHighlightIds,
    roomSurfaceIds,

    hullPoly: hullPoly.map(Poly.from),
    hullRect,
    hullTop: hullTop.map(Poly.from),

    items,
  };
  return parsed;
}

/**
 * @param {string} symbolName
 * @param {string} svgContents
 * @param {number} lastModified
 * @returns {Geomorph.ParsedSymbol<Poly>}
 */
export function parseStarshipSymbol(symbolName, svgContents, lastModified) {
  const $ = cheerio.load(svgContents);
  const topNodes = Array.from($('svg > *'));
  const pngRect = extractPngOffset($, topNodes);

  const hull = extractGeomsAt($, topNodes, 'hull');
  const obstacles = extractGeomsAt($, topNodes, 'obstacles');
  const singles = extractGeomsAt($, topNodes, 'singles');
  const walls = extractGeomsAt($, topNodes, 'walls');

  return {
    key: symbolName,
    hull: Poly.union(hull).map(x => x.precision(precision)),
    lastModified,
    obstacles: obstacles.map((/** @type {*} */ poly) => ({ meta: tagsToMeta(poly._ownTags, {}), poly })),
    pngRect,
    singles: singles.map((/** @type {*} */ poly) => ({ meta: tagsToMeta(poly._ownTags, {}), poly })),
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
 * Each symbol has a copy of the original PNG in group `background`.
 * It may have been offset e.g. so doors are aligned along border.
 * Then we need to extract the respective rectangle.
 * @param {import('cheerio').CheerioAPI} api
 * @param {Element[]} topNodes
 * @returns {Geom.RectJson}
 */
function extractPngOffset(api, topNodes) {
  const group = topNodes.find(x => hasTitle(api, x, 'background'));
  const { attribs: a } = api(group).children('image').toArray()[0];
  return {
    x: Number(a.x || 0),
    y: Number(a.y || 0),
    width: Number(a.width || 0),
    height: Number(a.height || 0),
  };
}

/** @param {Poly[]} polys */
function toJsons(polys) {
  return polys.map(x => x.geoJson);
}

/**
 * - `GeomorphData` extends `ParsedLayout` and comes from `useGeomorph`
 * - `GeomorphDataInstance` extends `GeomorphData`, is relative to `transform` and comes from `useGeomorphs`
 * @param {Geomorph.GeomorphData} gm 
 * @param {[number, number, number, number, number, number]} transform 
 */
export function geomorphDataToInstance(gm, transform) {
  const matrix = new Mat(transform);
  const gridRect = (new Rect(0, 0, 1200, gm.pngRect.height > 1000 ? 1200 : 600)).applyMatrix(matrix);
  const inverseMatrix = matrix.getInverseMatrix();

  /** @type {Geomorph.GeomorphDataInstance} */
  const output = {
    ...gm,
    itemKey: `${gm.key}-[${transform}]`,
    transform,
    transformOrigin: `${-gm.pngRect.x}px ${-gm.pngRect.y}px`,
    transformStyle: `matrix(${transform})`,
    matrix,
    inverseMatrix,
    gridRect,
  };

  return output;
}

/**
 * @param {Geomorph.ParsedLayout} gm 
 */
export function computeLightDoorRects(gm) {
  const lightPolys = computeLightPolygons(gm, true);
  /** Computed items are stored here */
  const lightRects = /** @type {Geomorph.LightDoorRect[]} */ ([]);

  /**
   * @param {{ id: number; poly: Geom.Poly; roomId: number; }} light 
   * @param {number} roomId 
   * @param {{ doorIds: number[]; roomIds: number[]; lightRects: Geomorph.LightDoorRect[] }} pre previous
   * @param {number} depth 
   */
  function depthFirstLightRects(light, roomId, pre, depth) {
    if (depth <= 0) {
      return;
    }
    const nextRoomIds = pre.roomIds.concat(roomId); // Avoid revisit
    for (const { doorId } of gm.roomGraph.getAdjacentDoors(roomId)) {
      const doorPoly = gm.doors[doorId].poly;

      if (!Poly.intersect([doorPoly], [light.poly]).length) {
        continue; // can have parallel doors where light only goes thru some
      }

      const otherRoomId = getUnseenConnectorRoomId(gm.doors[doorId], nextRoomIds);
      if (otherRoomId === -1) {
        continue;
      }

      const otherRoomPoly = gm.rooms[otherRoomId];
      const outsetDoorPoly = geom.createOutset(doorPoly, 1)[0];
      const otherRoomIntersection = Poly.intersect([otherRoomPoly], [light.poly]).filter(
        // otherRoomIntersection can have disjoint pieces: choose right one
        poly => Poly.intersect([outsetDoorPoly], [poly]).length
      );
      if (!otherRoomIntersection.length) {
        continue;
      }

      lightRects.push({
        key: `door${doorId}@light${light.id}`,
        doorId,
        lightId: light.id,
        rect: otherRoomIntersection[0].rect.precision(0),
        srcRoomId: light.roomId,
        preDoorIds: pre.doorIds.slice(),
        postDoorIds: [], // computed directly below
      });
      pre.lightRects.forEach(preLightRect => preLightRect.postDoorIds.push(doorId));
      const nextPre = { doorIds: pre.doorIds.concat(doorId), roomIds: nextRoomIds, lightRects: pre.lightRects.concat(lightRects.slice(-1)) }
      depthFirstLightRects(light, otherRoomId, nextPre, --depth);
    }
  }

  lightPolys.forEach((lightPoly, lightId) => {
    const { roomId } = gm.lightSrcs[lightId];
    const light = { id: lightId, roomId, poly: lightPoly };
    depthFirstLightRects(light, roomId, { doorIds: [], roomIds: [], lightRects: [] }, 3);
  });

  for (let i = 0; i < lightRects.length; i++) {
    for (let j = i + 1; j < lightRects.length; j++) {
      const [ri, rj] = [i, j].map(k => lightRects[k]);
      if ((ri.lightId !== rj.lightId) && ri.rect.intersects(rj.rect)) {
        warn(`computeLightDoorRects: light rects for lights ${ri.lightId}, ${rj.lightId} should not be intersecting`);
      }
    }
  }

  return lightRects;
}

/**
 * Aligned to geomorph `lightSrcs`.
 * @param {Geomorph.ParsedLayout} gm
 */
export function computeLightPolygons(gm, intersectWithCircle = false) {
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

  
  if (intersectWithCircle) {// ℹ️ for GeomorphEdit

    const restrictedLightPolys = lightPolys.map((lightPoly, lightId) => {
      const { distance = defaultLightDistance, position } = gm.lightSrcs[lightId];
      const circlePoly = Poly.circle(position, distance, 30);
      return Poly.intersect([circlePoly], [lightPoly])[0] ?? new Poly;
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
}

/**
 * @param {Geomorph.ParsedConnectorRect} connector 
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
 * @param {Geomorph.ParsedConnectorRect[]} doors
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
    group.forEach(node => node.neighbours = node.neighbours.map(id => id + groupOffset));
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
   * when some vertex lie inside the room.
   */
  const roomNodeIds = /** @type {number[][]} */ ([]);

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
      tempTri.outline = node.vertexIds.map(vid => navZone.vertices[vid]);
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
  };
}

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
    meta[tag] = true; // Preserve tag even if foo=bar
    const eqIndex = tag.indexOf('=');
    if (eqIndex > -1) {
      meta[tag.slice(0, eqIndex)] = parseJsonArg(tag.slice(eqIndex + 1));
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

/** @param {string} input */
function parseJsonArg(input) {
  try {
    return input === undefined ? undefined : JSON.parse(input);
  } catch {
    return input;
  }
}

//#region decor

/**
 * @param {NPC.DecorDef} decor 
 * @param {Geom.VectJson} point 
 * @returns {boolean}
 */
export function decorContainsPoint(decor, point) {
  switch (decor.type) {
    case 'circle':
      return tempVect1.copy(point).distanceTo(decor.center) <= decor.radius;
    case 'group':
      return decor.items.some(item => decorContainsPoint(item, point));
    case 'path':
      return false;
    case 'point':
      return tempVect1.copy(point).equals(decor);
    case 'rect':
      return geom.outlineContains(decor.derivedPoly?.outline ?? [], point);
    default:
      throw testNever(decor);
  }
}

/** @param {string} decorKey */
export function decodeDecorInstanceKey(decorKey) {
  const [, gmId, roomId] = /** @type {string[]} */ (decorKey.match(localDecorSubKeyRegex));
  return { gmId: Number(gmId), roomId: Number(roomId) };
}

/**
 * Ensure decor.meta.{gmId,roomId} (possibly null)
 * @param {NPC.DecorSansPath} decor
 * @param {import('../world/World').State} api
 * @returns {NPC.DecorSansPath}
 */
export function ensureDecorMetaGmRoomId(decor, api) {
  decor.meta ??= {}; 
  if (typeof decor.meta.gmId !== 'number' || typeof decor.meta.roomId !== 'number') {
    const decorCenter = getDecorCenter(decor);
    const gmRoomId = api.gmGraph.findRoomContaining(decorCenter);
    decor.meta.gmId = (gmRoomId?.gmId) ?? api.gmGraph.findGeomorphIdContaining(decorCenter);
    decor.meta.roomId = (gmRoomId?.roomId) ?? null;
  }
  return decor;
}

/**
 * @param {NPC.DecorRect} decor
 * @returns {NPC.DecorRect}
 */
export function extendDecorRect(decor) {
  const poly = Poly.fromAngledRect({ angle: decor.angle ?? 0, baseRect: decor });
  decor.derivedPoly = poly;
  decor.derivedBounds = poly.rect;
  return decor;
}

/**
 * 
 * @param {NPC.DecorDef} decor 
 * @returns {Geom.VectJson}
 */
export function getDecorCenter(decor) {
  switch (decor.type) {
    case 'circle': return decor.center;
    case 'group': return Vect.average(decor.items.map(item => getDecorCenter(item)));
    case 'path': return Vect.average(decor.path);
    case 'point': return decor;
    case 'rect': {
      if (!decor.derivedPoly) extendDecorRect(decor);
      return assertDefined(decor.derivedPoly).center;
    }
    default: throw testNever(decor);
  }
}

/** @type {(gmId: number, roomId: number) => string} */
export function getLocalDecorGroupKey(gmId, roomId) {
  return `local-g${gmId}r${roomId}`;
}
export const localDecorSubKeyRegex = /^local-g(\d+)r(\d+)-/;

/**
 * @param {Geomorph.SvgGroupWithTags<Poly>} svgSingle
 * @param {number} singleIndex
 * @param {Geomorph.PointMeta} baseMeta Assumed fresh
 * @returns {NPC.DecorSansPath}
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

//#endregion

const tempVect1 = new Vect;
