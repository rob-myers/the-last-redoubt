import { useQuery } from "@tanstack/react-query";
import { Poly, Rect, Vect } from "../geom";
import { floorGraphClass } from "../graph/floor-graph";
import { svgSymbolTag } from "../service/const";
import { computeViewPosition, coordToRoomGrid, geomorphJsonPath, getNormalizedDoorPolys, singleToDecor } from "../service/geomorph";
import { warn } from "../service/log";
import { parseLayout } from "../service/geomorph";
import { geom } from "../service/geom";
import { doorSensorRadius, doorViewOffset, windowViewOffset } from "../world/const";
import usePathfinding from "./use-pathfinding";

/**
 * Extends `Geomorph.ParsedLayout` with fields to create `Geomorph.GeomorphData`.
 * This object must not refer to `gmId`.
 * It could refer to it via `geomorphDataToInstance`.
 * @param {Geomorph.GeomorphKey} layoutKey
 */
export default function useGeomorphData(layoutKey, disabled = false) {

  const gmDataResult = useQuery({
    queryKey: [geomorphJsonPath(layoutKey)],
    queryFn: () => createGeomorphData(layoutKey),
    gcTime: Infinity,
    // placeholderData: x => x,
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
  // Fetch existing layout, or use provided one from `GeomorphEdit`.
  const layout = typeof input === 'string'
    ? parseLayout(await fetch(geomorphJsonPath(input)).then(x => x.json()))
    : input
  ;

  const doorPolys = getNormalizedDoorPolys(layout.doors);

  const roomsWithDoors = layout.rooms.map((roomPoly, roomId) => {
    const roomDoorPolys = layout.roomGraph.getAdjacentDoors(roomId).map(x => doorPolys[x.doorId]);
    return Poly.union([roomPoly, ...roomDoorPolys])[0];
  });

  /**
   * Polys/rects tagged with `view` override default FOV position
   * - `poly` must be convex (e.g. rotated rect).
   * - `poly` must cover door and have center inside room.
   * - we permit multiple `view`s per connector
   */
  const viewMetas = layout.groups.singles
    .filter(x => x.meta[svgSymbolTag.view])
    .map(({ poly, meta }) => /** @type {const} */ (
      { center: poly.center, poly, meta }
    ));

  /**
   * Room Grid avoids checking many room polygons
   * @param {Geom.VectJson} point 
   * @param {boolean} [includeDoors] 
   * @returns {number}
   */
  function findRoomContaining(point, includeDoors = false) {
    const gridPos = coordToRoomGrid(point.x, point.y);
    const roomIds = layout.gridToRoomIds[gridPos.x]?.[gridPos.y] ?? [];
    // return roomIds.find(roomId => (includeDoors ? roomsWithDoors : layout.rooms)[roomId].contains(point)) ?? -1;
    return roomIds.find(roomId =>
      geom.outlineContains((includeDoors ? roomsWithDoors : layout.rooms)[roomId].outline, point)
    ) ?? -1;
  }

  //#region points by room
  // 🚧 precompute?
  const roomOverrides = /** @type {Geomorph.GeomorphData['roomOverrides']} */ ({});
  const roomDecor = layout.rooms.map(/** @returns {Geomorph.GeomorphData['roomDecor'][*]} */ (_, roomId) => ({
    
    symbol: [],
    door: layout.roomGraph.getAdjacentDoors(roomId).map(/** @return {NPC.DecorCircle | NPC.DecorRect} */ (doorNode) => {
      const { doorId } = doorNode;
      const door = layout.doors[doorId];
      const index = door.roomIds.indexOf(roomId);
      const pointInRoom = door.entries[index].clone().addScaledVector(door.normal, 5 * (index === 0 ? 1 : -1));

      if (layout.parallelDoorId[doorId]) {
        // Use rect so nearby parallel door sensors intersect without gaps
        const right = new Vect(doorSensorRadius * Math.cos(door.angle), doorSensorRadius * Math.sin(door.angle));
        const down = new Vect(-right.y, right.x);
        const baseRect = new Rect(pointInRoom.x - right.x - down.x, pointInRoom.y - right.y - down.y, 2 * doorSensorRadius, 2 * doorSensorRadius);
        const angle = door.angle;
        const derivedPoly = geom.angledRectToPoly({ baseRect, angle });

        return {
          type: 'rect',
          ...baseRect,
          angle,
          key: `door-${doorId}`, // instance key will be: ${parent.key}-${key}
          meta: { gmId: -1, doorId, roomId, doorSensor: true },
          derivedPoly,
          derivedBounds: derivedPoly.rect,
        };
      } else {
        return {
          key: `door-${doorId}`, // instance key will be: ${parent.key}-${key}
          type: 'circle',
          meta: { gmId: -1, doorId, roomId, doorSensor: true },
          center: pointInRoom,
          radius: doorSensorRadius,
        };
      }
    }),
  }));

  viewMetas.forEach(({ center: p, poly, meta }, i) => {
    let intersects = false;
    const roomId = findRoomContaining(p);

    // Unclear if a single 'view'-tagged rect should adjust view of each connector it intersects,
    // i.e. unclear if this is actually useful. But it avoids bugs where only one connector gets adjusted.

    layout.doors.forEach((door, doorId) => {
      if (geom.convexPolysIntersect(poly.outline, door.poly.outline)) {
        intersects = true;
        const otherRoomId = layout.doors[doorId].roomIds.find(x => x !== roomId);
        if (typeof otherRoomId === 'number') {
          (((
            roomOverrides[otherRoomId] ??= { doorViews: {}, windowView: {} }
          ).doorViews)[doorId] ??= []).push({ point: p, meta: {...meta} });
        } else {
          warn(`${'useGeomorphData'}: view ${i} lacks other roomId (room ${roomId} door ${doorId})`);
        }
      }
    });

    layout.windows.forEach((window, windowId) => {
      if (geom.convexPolysIntersect(poly.outline, window.poly.outline)) {
        intersects = true;
        const otherRoomId = layout.windows[windowId].roomIds.find(x => x !== roomId);
        if (typeof otherRoomId === 'number') {
          ((
            roomOverrides[otherRoomId] ?? { doorViews: {}, windowView: {} }
          ).windowView ??= [])[windowId] = p;
        } else {
          warn(`${'useGeomorphData'}: view ${i} lacks other roomId (room ${roomId} window ${windowId})`);
        }
      }
    });

    if (!intersects) {
      warn(`${'useGeomorphData'}: view ${i} intersects no doors/windows (room ${roomId})`);
    }
  });

  // 🤔 pre-compute?
  layout.groups.singles.forEach((single, i) => {
    if (single.meta.decor) {
      const p = single.poly.center;
      const roomId = findRoomContaining(p);
      if (roomId >= 0) {
        // ℹ️ decor is restricted to a single room
        roomDecor[roomId].symbol.push(singleToDecor(single, i, { gmId: -1, roomId }));
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

    doorToLightThru: layout.doors.map((_, doorId) => layout.lightThrus.find(x => x.doorId === doorId)),
    windowToLightThru: layout.windows.map((_, windowId) => layout.lightThrus.find(x => x.windowId === windowId)),

    roomOverrides,
    roomDecor,

    lazy: /** @type {*} */ (null), // Overwritten below
    floorGraph: floorGraphClass.createMock(), // Overwritten later

    findRoomContaining,
    getFurtherDoorRoom(srcDoorId, dstDoorId) {
      const [src] = this.doors[srcDoorId].entries;
      const { entries: [dstA, dstB], roomIds } = this.doors[dstDoorId];
      const index = src.distanceToSquared(dstA) >= src.distanceToSquared(dstB) ? 0 : 1;
      return roomIds[index] ?? /** @type {number} */ (roomIds[1 - index]);
    },
    getOtherRoomId(doorId, roomId) {
      // We support case where roomIds are equal e.g. gm 303
      const { roomIds } = this.doors[doorId];
      return roomIds.find((x, i) => typeof x === 'number' && roomIds[1 - i] === roomId) ?? -1;
    },
    getParallelDoorIds(doorId) {
      return this.parallelDoorId[doorId]?.doors ?? [];
    },
    getRelatedDoorIds(doorId) {
      return this.relDoorId[doorId]?.doors ?? [];
    },
    getViewDoorPositions(roomId, doorId) {
      /**
       * If `doorId` is a hull door then `this` is actually adjacent to Player's current geomorph.
       * Then we need to flip the view offset for usage with "the other hull door".
       */
      const hullSign = this.isHullDoor(doorId) ? -1 : 1;
      const customViews = this.roomOverrides[roomId]?.doorViews?.[doorId];
      if (customViews?.length) {
        return customViews.map(x => x.point);
      } else {// Default:
        return [computeViewPosition(this.doors[doorId], roomId, hullSign * doorViewOffset)];
      }
    },
    getViewWindowPosition(rootRoomId, windowId) {
      const point = this.roomOverrides[rootRoomId]?.windowView?.[windowId];
      return (point?.clone()
        || computeViewPosition(this.windows[windowId], rootRoomId, windowViewOffset)
      );
    },
    // 🚧 cache
    isOtherDoorBehind(srcRoomId, srcDoorId, dstDoorId) {
      const { behind } = this.relDoorId[srcDoorId].metas[dstDoorId];
      return behind[this.doors[srcDoorId].roomIds.indexOf(srcRoomId)];
    },
    isHullDoor(doorId) {
      return doorId < this.hullDoors.length;
    },

    rayIntersectsDoor(src, dst, roomId, doorIds) {
      const lambda = geom.raycastPolySansHoles(src, dst, this.roomsWithDoors[roomId]);
      if (lambda === null) {
        return null;
      }
      const doorId = doorIds.find(doorId => {
        // 🚧 clarify hard-coding
        const delta = (this.isHullDoor(doorId) ? 10 : 2) / Math.sqrt( (dst.x - src.x) ** 2 + (dst.y - src.y) ** 2 );
        const intersect = new Vect(src.x + (lambda - delta) * (dst.x - src.x), src.y + (lambda - delta) * (dst.y - src.y));
        return this.doors[doorId].poly.contains(intersect);
      });
      return doorId !== undefined ? { doorId, lambda } : null;
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

