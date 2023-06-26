import { useQuery } from "react-query";
import { Poly, Rect } from "../geom";
import { floorGraphClass } from "../graph/floor-graph";
import { svgSymbolTag } from "../service/const";
import { geomorphJsonPath, getNormalizedDoorPolys, singleToDecor } from "../service/geomorph";
import { warn } from "../service/log";
import { parseLayout } from "../service/geomorph";
import { geom } from "../service/geom";
import usePathfinding from "./use-pathfinding";

/**
 * @param {Geomorph.GeomorphKey} layoutKey
 */
export default function useGeomorphData(layoutKey, disabled = false) {

  const gmDataResult = useQuery(geomorphJsonPath(layoutKey), () => {
    return createGeomorphData(layoutKey)
  }, {
    cacheTime: Infinity,
    keepPreviousData: true,
    staleTime: Infinity,
    enabled: !disabled,
  });
  
  const pathfindingResult = usePathfinding(
    layoutKey,
    gmDataResult.data,
    disabled,
  );

  if (gmDataResult.data && pathfindingResult.data) {
    gmDataResult.data.floorGraph = pathfindingResult.data.graph;
    return gmDataResult.data;
  }
  if (gmDataResult.error) {
    console.error(`useGeomorphData: gmDataResult: ${layoutKey}`, gmDataResult.error);
  }
  if (pathfindingResult.error) {
    console.error('useGeomorphData: pathfindingResult', pathfindingResult.error);
  }

  return undefined;
}

/**
 * Converts
 * @see {Geomorph.ParsedLayout}
 * to
 * @see {Geomorph.GeomorphData}
 *
 * @param {Geomorph.GeomorphKey | Geomorph.ParsedLayout} input
 * @returns {Promise<Geomorph.GeomorphData>}
 */
export async function createGeomorphData(input) {

  const layout = typeof input === 'string'
    ? parseLayout(await fetch(geomorphJsonPath(input)).then(x => x.json()))
    : input // for GeomorphEdit
  ;
  const { roomGraph } = layout;

  const doorPolys = getNormalizedDoorPolys(layout.doors);
  const roomsWithDoors = layout.rooms.map((roomPoly, roomId) => {
    const roomDoorPolys = roomGraph.getAdjacentDoors(roomId).map(x => doorPolys[x.doorId]);
    return Poly.union([roomPoly, ...roomDoorPolys])[0];
  });

  /**
   * Polys/rects tagged with `view` override default FOV position
   * - `poly` must be convex (e.g. rotated rect).
   * - `poly` must cover door and have center inside room.
   */
  const viewMetas = layout.groups.singles
    .filter(x => x.meta[svgSymbolTag.view])
    .map(({ poly, meta }) => /** @type {const} */ (
      { center: poly.center, poly, reverse: meta.reverse, meta }
    ));

  /**
   * Each `relate-connectors` relates a doorId to other doorId(s) or windowId(s).
   * We'll use them to extend the view polygon e.g. when doors face one another.
   */
  const relDoorId = layout.groups.singles
    .filter(x => x.meta[svgSymbolTag['relate-connectors']])
    .reduce((agg, { poly }) => {
      const doorIds = layout.doors.flatMap((door, doorId) => geom.convexPolysIntersect(door.poly.outline, poly.outline) ? doorId : []);
      const windowIds = layout.windows.flatMap((window, windowId) => geom.convexPolysIntersect(window.poly.outline, poly.outline) ? windowId : []);
      doorIds.forEach(doorId => {
        agg[doorId] = agg[doorId] || { doorIds: [], windowIds: [] };
        agg[doorId].doorIds.push(...doorIds.filter(x => x !== doorId));
        agg[doorId].windowIds.push(...windowIds);
      });
      if (doorIds.length === 0)
        console.warn(`poly tagged "${svgSymbolTag['relate-connectors']}" doesn't intersect any door: (windowIds ${windowIds})`);
      if (doorIds.length + windowIds.length <= 1)
        console.warn(`poly tagged "${svgSymbolTag['relate-connectors']}" should intersect ≥ 2 doors/windows (doorIds ${doorIds}, windowIds ${windowIds})`);
      return agg;
    },
    /** @type {Geomorph.GeomorphData['relDoorId']} */ ({}),
  );

  const parallelDoorId = layout.groups.singles
    .filter(x => x.meta[svgSymbolTag["parallel-connectors"]])
    .reduce((agg, { poly }) => {
      const doorIds = layout.doors.flatMap((door, doorId) => geom.convexPolysIntersect(door.poly.outline, poly.outline) ? doorId : []);
      doorIds.forEach(doorId => {
        agg[doorId] ||= { doorIds: [] };
        const alreadySeen = agg[doorId].doorIds;
        agg[doorId].doorIds.push(...doorIds.filter(x => x !== doorId && !alreadySeen.includes(x)));
      });
      if (doorIds.length <= 1)
        console.warn(`poly tagged "${svgSymbolTag["parallel-connectors"]}" should intersect ≥ 2 doors: (doorIds ${doorIds})`);
      return agg;
    },
    /** @type {Geomorph.GeomorphData['parallelDoorId']} */ ({}),
  );

  //#region points by room
  const roomOverrides = layout.rooms.map(/** @returns {Geomorph.GeomorphData['roomOverrides'][*]} */  x => ({}));
  const roomDecor = layout.rooms.map(/** @returns {NPC.DecorGroupItem[]} */ (_, roomId) =>
  [
      // add circle for each door adjacent to room
      ...roomGraph.getAdjacentDoors(roomId).map(x => layout.doors[x.doorId]).map(/** @return {NPC.DecorCircle} */ (door, doorId) => ({
        key: `door-${doorId}`, // overwritten
        type: 'circle',
        meta: { roomId, doorSensor: true }, // 🚧 more?
        center: door.poly.center,
        radius: 60,
      }))
    ]
  );

  viewMetas.forEach(({ center: p, poly, reverse, meta }, i) => {
    let roomId = layout.rooms.findIndex(poly => poly.contains(p));
    const doorId = layout.doors.findIndex((door) => geom.convexPolysIntersect(poly.outline, door.poly.outline));
    const windowId = layout.windows.findIndex((window) => geom.convexPolysIntersect(poly.outline, window.poly.outline));

    if (roomId === -1 || (doorId === -1 && windowId === -1)) {
      console.warn(`useGeomorphData: light ${i} has room/door/windowId ${roomId}/${doorId}/${windowId}`);
    } else if (reverse) {// Reversed light comes from otherRoomId
      const otherRoomId = doorId >= 0
        ? layout.doors[doorId].roomIds.find(x => x !== roomId)
        : layout.windows[windowId].roomIds.find(x => x !== roomId);
      if (typeof otherRoomId !== 'number') {
        console.warn(`useGeomorphData: reverse light ${i} lacks other roomId (room/doorId ${roomId}/${doorId})`);
      } else roomId = otherRoomId;
    }// NOTE roomId could be -1

    doorId >= 0 && ((roomOverrides[roomId].doorView ||= [])[doorId] = {
      point: p,
      meta: {...meta},
    });
    windowId >= 0 && ((roomOverrides[roomId].windowView ||= [])[windowId] = p);
  });

  layout.groups.singles.forEach((single, i) => {
    if (single.meta.decor) {
      const p = single.poly.center;
      const roomId = layout.rooms.findIndex(x => x.contains(p));
      if (roomId >= 0) {
        // ℹ️ decor is restricted to a single room
        roomDecor[roomId].push(singleToDecor(single, i, { roomId }));
      } else if (single.meta.label) {
        // ℹ️ ignore "label" e.g. fuel is a solid wall (not a room)
        // ℹ️ label could instead be placed nearby respective hull symbols
      } else {
        console.warn(`decor (single ${JSON.stringify(single.meta)}) should be inside some room (${layout.key})`)  
      }
    }
  });
  //#endregion

  /** @type {Geomorph.GeomorphData} */
  const output = {
    ...layout,

    hullDoors: layout.doors.filter(({ meta }) => meta.hull),
    hullOutline: layout.hullPoly[0].removeHoles(),
    pngRect: Rect.fromJson(layout.items[0].pngRect),
    roomsWithDoors,

    relDoorId,
    parallelDoorId,
    doorToLightRect: layout.doors.map((_, doorId) => layout.lightRects.find(x => x.doorId === doorId)),

    roomOverrides,
    roomDecor,

    lazy: /** @type {*} */ (null), // Overwritten below
    floorGraph: floorGraphClass.createMock(), // Overwritten later

    getHullDoorId(doorOrId) {
      const door = typeof doorOrId === 'number' ? this.doors[doorOrId] : doorOrId
      return this.hullDoors.indexOf(door);
    },
    getOtherRoomId(doorOrId, roomId) {
      return (typeof doorOrId === 'number' ? this.doors[doorOrId] : doorOrId)
        .roomIds.find(id => id !== roomId) ?? -1;
    },
    isHullDoor(doorOrId) {
      return (typeof doorOrId === 'number' ? this.doors[doorOrId] : doorOrId)
        .roomIds.includes(null);
    },
  };

  output.lazy = createLazyProxy(output);
  extendRoomNodeIds(output);

  return output;
}

/**
 * Create a proxy for lazy computations
 * @param {Geomorph.GeomorphData} gm
 */
function createLazyProxy(gm) {
  const root = {
    /**
     * Intersection of `navPoly` with `roomWithDoors[roomId]`,
     * restricted to largest disconnected component (assume others are artifacts).
     */
    roomNavPoly: /** @type {{ [roomId: number]: Geom.Poly }} */ ({}),
  };

  const roomNavPolyProxy = new Proxy({}, {
    get(_, key) {
      if (typeof key !== 'string') return;
      const roomId = Number(key);
      if (gm.roomsWithDoors[roomId] && !root.roomNavPoly[roomId]) {
        const intersection = Poly.intersect(gm.navPoly, [gm.roomsWithDoors[roomId]]);
        intersection.sort((a, b) => a.rect.area > b.rect.area ? -1 : 1);
        root.roomNavPoly[roomId] = intersection[0];
      }
      return root.roomNavPoly[roomId];
    }
  });

  return new Proxy(root, {
    /** @param {keyof typeof root} key */
    get(_, key) {
      if (key === 'roomNavPoly') {
        return roomNavPolyProxy;
      }
    },
  })
}

/**
 * For each nav node inside a hull doorway,
 * add its id to its respective (unique) room.
 * @param {Geomorph.GeomorphData} gm
 */
function extendRoomNodeIds(gm) {
  gm.navZone.doorNodeIds.forEach((navNodeIds, doorId) => {
    const door = gm.doors[doorId];
    if (gm.hullDoors.includes(door)) {
      const roomId = /** @type {number} */ (door.roomIds.find(x => x !== null));
      if (Number.isFinite(roomId)) {
        gm.navZone.roomNodeIds[roomId].push(...navNodeIds);
      } else {
        warn(`extendRoomNodeIds: ${gm.key} (hull) door ${doorId} has empty roomIds`);
      }
    }
  });
}

