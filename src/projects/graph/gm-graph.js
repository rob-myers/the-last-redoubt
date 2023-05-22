import { Mat, Poly, Rect, Vect } from "../geom";
import { BaseGraph } from "./graph";
import { assertNonNull, removeDups } from "../service/generic";
import { geom, directionChars, isDirectionChar } from "../service/geom";
import { computeViewPosition, getConnectorOtherSide, findRoomIdContaining as findLocalRoomContaining } from "../service/geomorph";
import { error } from "../service/log";
import { lightDoorOffset, lightWindowOffset, precision } from "../service/const";

/**
 * Geomorph Graph i.e. a graph whose nodes are geomorphs.
 * We use lowercase:
 * @see gmGraphClass
 * to get react-refresh to update the class.
 * @extends {BaseGraph<Graph.GmGraphNode, Graph.GmGraphEdgeOpts>}
 */
export class gmGraphClass extends BaseGraph {

  /** @type {Geomorph.GeomorphDataInstance[]}  */
  gms;

  /**
   * Technically, for each `key` we provide the last item of `gms` with this `key`.
   * All such items have the same underlying `Geomorph.GeomorphData`.
   * @readonly
   * @type {{ [gmKey in Geomorph.GeomorphKey]?: Geomorph.GeomorphData }}
   */
  gmData;

  /**
   * World coordinates of entrypoint to hull door nodes.
   * @type {Map<Graph.GmGraphNodeDoor, Geom.Vect>}
   */
  entry;

  api = /** @type {import('../world/World').State} */  ({ isReady() { return false; } });

  /** @param {Geomorph.GeomorphDataInstance[]} gms  */
  constructor(gms) {
    super();
    this.gms = gms;
    this.gmData = gms.reduce((agg, gm) => ({ ...agg, [gm.key]: gm }), {});
    this.entry = new Map;
  }

  /**
   * Compute viewable area, determined by current room and open doors.
   * @param {number} gmId 
   * @param {number} rootRoomId 
   * @returns {{ polys: Poly[][]; gmRoomIds: Graph.GmRoomId[] }}
   */
  computeDoorViews(gmId, rootRoomId) {
    const gm = this.gms[gmId];
    const openDoorsIds = this.api.doors.getOpen(gmId);

    /** Ids of open doors connected to rootRoom */
    const doorIds = gm.roomGraph.getAdjacentDoors(rootRoomId).flatMap(
      ({ doorId }) => openDoorsIds.includes(doorId) ? doorId : []
    );
    /**
     * Each area is constructed by joining 2 roomWithDoors,
     * i.e. either side of the door corresponding to `doorId`.
     */
    const doorViewAreas = doorIds.flatMap((doorId) =>
      this.computeDoorViewArea(gmId, doorId, openDoorsIds, doorIds)??[]
    );
    /**
     * For each area we raycast a light from specific position.
     */
    const unjoinedViews = doorViewAreas.flatMap(({ area }) => {
      /**
       * We need additional line segments for:
       * - doors parallel to area.door
       * - closed doors related to area.door
       *
       * They prevent light going through closed parallel doors, and
       * unsightly light patterns through open doors.
       * Parallel doors can be over-approx via roomGraph.getAdjacentDoors,
       * but we prefer an explicit approach.
       */
      const areaGm = this.gms[area.gmId];
      const isOpen = this.api.doors.open[area.gmId];
      const blockedDoorIds = [
        ...(areaGm.parallelDoorId[area.doorId]?.doorIds??[]),
        ...(areaGm.relDoorId[area.doorId]?.doorIds??[]).filter(doorId => !isOpen[doorId]),
      ];

      /** We imagine we are viewing from the center of the door */
      const viewPos = areaGm.doors[area.doorId].poly.center;
      // 🚧 These segs are not perfect i.e. part of door will be covered
      const extraSegs = blockedDoorIds.map(doorId => getConnectorOtherSide(areaGm.doors[doorId], viewPos));

      return {
        gmId: area.gmId,
        poly: geom.lightPolygon({
          position: this.getDoorViewPosition(area.gmId, rootRoomId, area.doorId),
          range: 2000,
          exterior: area.poly,
          extraSegs,
        }),
      };
    });

    /** Door ids connected to root room, including related ones */
    const allDoorIds = doorIds.concat(doorViewAreas.flatMap(x => x.relDoorIds));

    return {
      polys: this.gms.map((_, gmId) =>
        /**
         * Use high precision to avoid occasional "Unable to complete output ring"
         * > https://github.com/Turfjs/turf/issues/2048
         */
        unjoinedViews.filter(x => x.gmId === gmId).map(x => x.poly.precision(8))
      ),
      gmRoomIds: this.getRoomsFromGmDoorIds(gmId, allDoorIds),
    };
  }

  /**
   * @param {number} gmId 
   * @param {number} doorId 
   * @param {number[]} openDoorIds 
   * @param {number[]} adjOpenDoorIds 
   */
  computeDoorViewArea(gmId, doorId, openDoorIds, adjOpenDoorIds) {
    const gm = this.gms[gmId];
    const area = this.getOpenDoorArea(gmId, doorId);
    if (!area) {
      return null;
    }

    /**
     * - In SVG `relate-connectors` tag induced a relation between doorIds.
     *   We extend_light area when exactly one of them is in
     *   @see {adjOpenDoorIds}.
     * - Light is extended through a door in an adjacent room,
     *   non-adjacent to current room.
     * - 🚧 test relations R(doorId, windowId)
     */
    const relDoorIds = (gm.relDoorId[doorId]?.doorIds || []).filter(relDoorId =>
      openDoorIds.includes(relDoorId)
      && !adjOpenDoorIds.includes(relDoorId)
    );

    // Windows are always open, and assumed visible if related door open
    const relWindowIds = (gm.relDoorId[doorId]?.windowIds || []);
    if (relDoorIds.length || relWindowIds.length) {
      area.poly = Poly.union([area.poly,
        ...relDoorIds.flatMap(relDoorId => this.getOpenDoorArea(gmId, relDoorId)?.poly || []),
        ...relWindowIds.flatMap(relWindowId => this.getOpenWindowPolygon(gmId, relWindowId)),
      ])[0];
    }

    return { area, relDoorIds };
  }

  /**
   * TODO 🚧 verify
   * Assume `transform` is non-singular and [±1, ±1, ±1, ±1, x, y]
   * @param {Geomorph.ConnectorRect<Poly, Vect, Rect>} hullDoor
   * @param {number} hullDoorId
   * @param {[number, number, number, number, number, number]} transform
   * @param {Geomorph.GeomorphKey} gmKey
   * @returns {null | Geom.Direction}
   */
  static computeHullDoorDirection(hullDoor, hullDoorId, transform, gmKey) {
    const { hullDir } = hullDoor.meta;
    if (isDirectionChar(hullDir)) {
      const direction = /** @type {Geom.Direction} */ (directionChars.indexOf(hullDir));
      const ime1 = { x: transform[0], y: transform[1] };
      const ime2 = { x: transform[2], y: transform[3] };
      
      if (ime1.x === 1) {// (1, 0)
        if (ime2.y === 1) // (1, 0, 0, 1)
          return direction;
        if (ime2.y === -1) // (1, 0, 0, -1)
          return geom.getFlippedDirection(direction, 'x');
      } else if (ime1.y === 1) {// (0, 1)
        if (ime2.x === 1) // (0, 1, 1, 0)
          return geom.getFlippedDirection(geom.getDeltaDirection(direction, 2), 'y'); 
        if (ime1.x === -1) // (0, 1, -1, 0)
          return geom.getDeltaDirection(direction, 1);
      } else if (ime1.x === -1) {// (-1, 0)
        if (ime2.y === 1) // (-1, 0, 0, 1)
          return geom.getFlippedDirection(direction, 'y');
        if (ime2.y === -1) // (-1, 0, 0, -1)
          return geom.getDeltaDirection(direction, 2);
      } else if (ime1.y === -1) {// (0, -1)
        if (ime2.x === 1) // (0, -1, 1, 0)
          return geom.getDeltaDirection(direction, 3);
        if (ime2.x === -1) // (0, -1, -1, 0)
          return geom.getFlippedDirection(geom.getDeltaDirection(direction, 3), 'y');
      }
      error(`${gmKey}: hull door ${hullDoorId}: ${hullDir}: failed to parse transform "${transform}"`);
    } else if (!hullDoor.meta.sealed) {
      error(`${gmKey}: unsealed hull door ${hullDoorId}: meta.hullDir "${hullDir}" must be in {n,e,s,w}`);
    }
    return null;
  }

  /**
   * Compute lit area: extend current room by view through open doors and windows.
   * @param {number} gmId 
   * @param {number} rootRoomId 
   * @returns {{ polys: Poly[][]; gmRoomIds: Graph.GmRoomId[] }}
   */
  computeViewPolygons(gmId, rootRoomId) {
    const { polys: doorViews, gmRoomIds } = this.computeDoorViews(gmId, rootRoomId);
    const windowLights = this.computeWindowViews(gmId, rootRoomId); // 🚧 provide {gmId,roomId}?
    // Combine doors and windows
    const viewPolys = doorViews.map((lights, i) => lights.concat(windowLights[i]));
    // Always include current room
    viewPolys[gmId].push(this.gms[gmId].roomsWithDoors[rootRoomId]);
    gmRoomIds.length === 0 && gmRoomIds.push({ gmId, roomId: rootRoomId });
    return {
      /**
       * Try to eliminate "small black triangular polys", arising from
       * intersecting view polys. Side effect: intermediate walls can become black.
       */
      polys: viewPolys.map(polys => Poly.unionSafe(polys).map(x => x.removeHoles())),
      // polys: viewPolys.map(polys => Poly.union(polys.map(x => x.precision(4))).map(x => x.removeHoles()) ),
      gmRoomIds,
    };
  }

  /**
   * Compute viewable area, determined by current room and open windows.
   * @param {number} gmId 
   * @param {number} rootRoomId 
   * @returns {Poly[][]}
   */
  computeWindowViews(gmId, rootRoomId) {
    const gm = this.gms[gmId];

    const windowIds = gm.roomGraph.getAdjacentWindows(rootRoomId).filter(({ windowId }) => {
      const connector = gm.windows[windowId];
        if (connector.meta.frosted) {
          return false; // Frosted windows are opaque
        }
        if (// One-way mirror
          (connector.meta['one-way'] && connector.roomIds[0] !== rootRoomId)
          ||
          (connector.meta['one-way-reverse'] && connector.roomIds[0] === rootRoomId)
        ) {
          return false;
        }
        return true;
    }).map(x => x.windowId);

    const unjoinedViews = windowIds.map(windowId => ({
      gmId,
      poly: geom.lightPolygon({
        position: (
          gm.point[rootRoomId]?.windowLight[windowId]
          // We move light inside current room
          || computeViewPosition(gm.windows[windowId], rootRoomId, lightWindowOffset)
        ),
        range: 1000,
        exterior: this.getOpenWindowPolygon(gmId, windowId),
      }),
    }));

    return this.gms.map((_, gmId) =>
      // https://github.com/Turfjs/turf/issues/2048
      unjoinedViews.filter(x => x.gmId === gmId).map(x => x.poly.precision(8))
    );
  }

  /**
   * @param {Geom.VectJson} point
   * @returns {null | Geomorph.GeomorphDataInstance} gmId
   */
  findGeomorphContaining(point) {
      return this.gms.find(x => x.gridRect.contains(point)) ?? null;
  }

  /**
   * @param {Geom.VectJson} point
   * @returns {null | number} gmId
   */
  findGeomorphIdContaining(point) {
      const gmId = this.gms.findIndex(x => x.gridRect.contains(point));
      return gmId === -1 ? null : gmId;
  }

  /**
   * Find geomorph edge path using simplistic global nav strategy.
   * @param {Geom.VectJson} src
   * @param {Geom.VectJson} dst 
   */
  findPath(src, dst) {
    const srcGmId = this.findGeomorphIdContaining(src);
    const dstGmId = this.findGeomorphIdContaining(dst);
    if (srcGmId === null || dstGmId === null) {
      return null;
    }
    
    const gmEdges = /** @type {Graph.NavGmTransition[]} */ ([]);
    const currSrc = Vect.from(src);
    const direction = Vect.from(dst).sub(src);
    let gmId = srcGmId;

    while (gmId !== dstGmId) {
      const sides = geom.compassPoints(direction);
      /**
       * Restrict to hull door nodes in geomorph `gmId`,
       * connected to other geomorphs by some side in `sides`. 
       * Intuitively, restrict to hull doors in `direction`.
       */
      const doorNodes = sides.flatMap(sideDir =>
        this.getConnectedDoorsBySide(gmId, sideDir)
      );
      /**
       * Choose node in `doorNodes` with exit closest to final destination.
       * This is a rather simplistic strategy, and depends on the respective
       * topology being "nice" e.g. uses up as much space as possible.
       */
      const closest = doorNodes.reduce((agg, doorNode) => {
        const v = this.getDoorEntry(doorNode);
        const d = v.distanceToSquared(dst);
        if (!agg.node || d < agg.d) return { d, v, node: doorNode };
        return agg;
      }, /** @type {{ d: number; v: Vect; node?: Graph.GmGraphNodeDoor }} */ ({ d: Infinity, v: new Vect }));

      if (closest.node) {
        const adjDoorNode = this.getAdjacentDoor(closest.node);
        if (!adjDoorNode || adjDoorNode.gmId === gmId) {
          error(`global nav: ${gmId} ${closest.node.id} has no adjacent door`);
          return null;
        }

        gmEdges.push({
          srcGmId: gmId,
          srcRoomId: /** @type {number} */ (this.gms[gmId].doors[closest.node.doorId].roomIds.find(x => x !== null)),
          srcDoorId: closest.node.doorId,
          srcHullDoorId: closest.node.hullDoorId,
          srcDoorEntry: closest.v,

          dstGmId: adjDoorNode.gmId,
          dstRoomId: /** @type {number} */ (this.gms[adjDoorNode.gmId].doors[adjDoorNode.doorId].roomIds.find(x => x !== null)),
          dstDoorId: adjDoorNode.doorId,
          dstHullDoorId: adjDoorNode.hullDoorId,
          dstDoorEntry: this.getDoorEntry(adjDoorNode),
        });

        // Goto next geomorph
        gmId = adjDoorNode.gmId;
        currSrc.copy(closest.v);
        direction.copy(dst).sub(currSrc);
      } else {
        error(`global nav: ${gmId} ${sides}: no closest node`);
        return null;
      }
    }

    return gmEdges;
  }

  /**
   * @param {Geom.VectJson} point
   * @returns {null | Geomorph.GmRoomId}
   */
  findRoomContaining(point) {
    const gmId = this.findGeomorphIdContaining(point);
    if (gmId !== null) {
      const gm = this.gms[gmId];
      const roomId = findLocalRoomContaining(gm.rooms, gm.inverseMatrix.transformPoint(Vect.from(point)));
      if (roomId >= 0) {
        return { gmId, roomId };
      }
    }
    return null;
  }

  /**
   * @param {Graph.GmGraphNode} node 
   */
  getAdjacentDoor(node) {
    const doorNode = this.getSuccs(node).find(x => x.type === 'door');
    return doorNode ? /** @type {Graph.GmGraphNodeDoor} */ (doorNode) : null;
  }

  /**
   * @param {number} gmId 
   * @param {number} hullDoorId 
   * @returns {Graph.GmAdjRoomCtxt | null}
   */
  getAdjacentRoomCtxt(gmId, hullDoorId) {
    const gm = this.gms[gmId];
    const gmNode = this.nodesArray[gmId];
    const doorNodeId = getGmDoorNodeId(gm.key, gm.transform, hullDoorId);
    const doorNode = this.getNodeById(doorNodeId);
    if (!doorNode) {
      console.error(`${gmGraphClass.name}: failed to find hull door node: ${doorNodeId}`);
      return null;
    }
    const otherDoorNode = /** @type {undefined | Graph.GmGraphNodeDoor} */ (this.getSuccs(doorNode).find(x => x !== gmNode));
    if (!otherDoorNode) {
      console.info(`${gmGraphClass.name}: hull door ${doorNodeId} on boundary`);
      return null;
    }
    // `door` is a hull door and connected to another
    // console.log({otherDoorNode});
    const { gmId: adjGmId, hullDoorId: dstHullDoorId, doorId: adjDoorId } = otherDoorNode;
    const { roomIds } = this.gms[adjGmId].hullDoors[dstHullDoorId];
    const adjRoomId = /** @type {number} */ (roomIds.find(x => typeof x === 'number'));
    return { adjGmId, adjRoomId, adjHullId: dstHullDoorId, adjDoorId };
  }

  /**
   * @param {Geom.VectJson} position in world coords
   * @returns {Geom.ClosestOnOutlineResult | null}
   */
  getClosePoint(position) {
    const gmId = this.findGeomorphIdContaining(position);
    if (gmId !== null) {
      const gm = this.gms[gmId];
      const floorGraph = gm.floorGraph;
      gm.inverseMatrix.transformPoint(position = { x: position.x, y: position.y });
      const result = floorGraph.getClosePoint(position);
      gm.matrix.transformPoint(result.point);
      return result;
    } else {
      return null;
    }
  }

  /**
   * Get door nodes connecting `gms[gmId]` on side `sideDir`.
   * @param {number} gmId 
   * @param {Geom.Direction} sideDir 
   */
  getConnectedDoorsBySide(gmId, sideDir) {
    const gmNode = /** @type {Graph.GmGraphNodeGm} */ (this.nodesArray[gmId]);
    const doorNodes = /** @type {Graph.GmGraphNodeDoor[]} */ (this.getSuccs(gmNode));
    return doorNodes.filter(x => !x.sealed && x.direction === sideDir);
  }

  /**
   * Compute every global room id connected to some door in a single geomorph.
   * @param {number} gmId 
   * @param {number[]} doorIds Doors in geomorph `gmId`
   */
  getRoomsFromGmDoorIds(gmId, doorIds) {
    const gm = this.gms[gmId];
    const seen = /** @type {Record<number, true>} */ ({});
    const output = /** @type {Graph.GmRoomId[]} */ ([]);

    for (const doorId of doorIds) {
      const door = gm.doors[doorId];
      door.roomIds.forEach(roomId => {
        if (roomId === null) {// Hull door
          const ctxt = this.getAdjacentRoomCtxt(gmId, gm.getHullDoorId(door));
          ctxt && output.push({ gmId: ctxt.adjGmId, roomId: ctxt.adjRoomId });
        } else {// Non-hull door (avoid dups)
          !seen[roomId] && (seen[roomId] = true) && output.push({ gmId, roomId });
        }
      })
    }
    return output;
  }

  /**
   * Given ids of rooms in gmGraph, provide "adjacency data".
   * - We do include rooms adjacent via a door or non-frosted window.
   * - We handle dup roomIds e.g. via double doors.
   * - We don't ensure input roomIds are output.
   *   However they're included if they're adjacent to another such input roomId.
   * @param {Graph.GmRoomId[]} roomIds
   * @param {boolean} [doorsMustBeOpen]
   * @returns {Graph.GmRoomsAdjData}
   */
  getRoomIdsAdjData(roomIds, doorsMustBeOpen = false) {
    const output = /** @type {Graph.GmRoomsAdjData} */ ({});

    for (const { gmId, roomId } of roomIds) {
      const gm = this.gms[gmId];
      const openDoorIds = this.api.doors.getOpen(gmId);
      // Non-hull doors or windows induce an adjacent room
      !output[gmId] && (output[gmId] = { gmId, roomIds: [], windowIds: [], closedDoorIds: [] });
      output[gmId].roomIds.push(...gm.roomGraph.getAdjRoomIds(roomId, doorsMustBeOpen ? openDoorIds : undefined));
      output[gmId].windowIds.push(...gm.roomGraph.getAdjacentWindows(roomId).flatMap(x => gm.windows[x.windowId].meta.frosted ? [] : x.windowId));
      output[gmId].closedDoorIds.push(...gm.roomGraph.getAdjacentDoors(roomId).flatMap(x => openDoorIds.includes(x.doorId) ? [] : x.doorId));
      // Connected hull doors induce room in another geomorph
      // 🚧 check if hull doors are open?
      // 🚧 currently ignore hull windows 
      const hullDoorIds = gm.roomGraph.getAdjacentHullDoorIds(gm, roomId);
      hullDoorIds
        .filter(({ hullDoorId }) => !this.isHullDoorSealed(gmId, hullDoorId))
        .forEach(({ hullDoorId }) => {
          const ctxt = assertNonNull(this.getAdjacentRoomCtxt(gmId, hullDoorId));
          !output[ctxt.adjGmId] && (output[ctxt.adjGmId] = { gmId: ctxt.adjGmId, roomIds: [], windowIds: [], closedDoorIds: [] });
          output[ctxt.adjGmId].roomIds.push(ctxt.adjRoomId);
        });
    }

    Object.values(output).forEach(x => x.roomIds = removeDups(x.roomIds));
    return output;
  }

  /** @param {Graph.GmGraphNodeDoor} doorNode */
  getDoorEntry(doorNode) {
    return /** @type {Geom.Vect} */ (this.entry.get(doorNode));
  }

  /**
   * @param {string} nodeId 
   */
  getDoorNode(nodeId) {
    return /** @type {Graph.GmGraphNodeDoor} */ (this.getNodeById(nodeId));
  }

  /**
   * @param {number} gmId 
   * @param {number} hullDoorId 
   */
  getDoorNodeById(gmId, hullDoorId) {
    const gm = this.gms[gmId];
    const nodeId = getGmDoorNodeId(gm.key, gm.transform, hullDoorId);
    return /** @type {Graph.GmGraphNodeDoor} */ (this.getNodeById(nodeId));
  }

  /**
   * By default we move light inside current room by constant amount.
   * Sometimes this breaks (lies outside current room) or looks bad when combined,
   * so can override via 'view' tagged rects.
   * @param {number} gmId
   * @param {number} rootRoomId
   * @param {number} doorId
   */
  getDoorViewPosition(gmId, rootRoomId, doorId, permitReversed = true) {
    const gm = this.gms[gmId];
    // Seems some geomorphs lack gm.point[x]
    const custom = gm.point[rootRoomId]?.doorView[doorId];
    return (
      custom && (permitReversed || !custom.meta.reverse)
        ? custom.point.clone()
        : computeViewPosition(gm.doors[doorId], rootRoomId, lightDoorOffset)
    );
  }

  /**
   * Non-hull doors:
   * - output gmId is input gmId.
   * - area is union of roomsWithDoors on either side of door.
   *
   * Hull doors:
   * - output gmId is adjacent gmId
   * - area is union of roomsWithDoors on either side, relative to adjacent gmId
   * @param {number} gmId 
   * @param {number} doorId
   * @returns {null | Graph.OpenDoorArea}
   */
  getOpenDoorArea(gmId, doorId) {
    const gm = this.gms[gmId];
    const door = gm.doors[doorId];
    const hullDoorId = gm.getHullDoorId(door);

    if (hullDoorId === -1) {
      const adjRoomNodes = gm.roomGraph.getAdjacentRooms(gm.roomGraph.getDoorNode(doorId));
      const adjRooms = adjRoomNodes.map(x => gm.roomsWithDoors[x.roomId]);
      // const adjRoomsSansHoles = adjRoomNodes.map(x => new Poly(gm.roomsWithDoors[x.roomId].outline));
      return { gmId, doorId, adjRoomId: null, poly: Poly.union(adjRooms)[0] };
    }

    const result = this.getAdjacentRoomCtxt(gmId, hullDoorId);
    if (result) {
      const srcRoomId = /** @type {number} */ (door.roomIds.find(x => typeof x === 'number'));
      const otherGm = this.gms[result.adjGmId];
      const otherGmRoom = otherGm.roomsWithDoors[result.adjRoomId];
      // const otherGmRoomSansHoles = new Poly(otherGm.roomsWithDoors[result.adjRoomId].outline);
      const poly = Poly.union([// We transform poly from `gm` coords to `otherGm` coords
        gm.roomsWithDoors[srcRoomId].clone().applyMatrix(gm.matrix).applyMatrix(otherGm.inverseMatrix),
        otherGmRoom,
      ])[0];

      return { gmId: result.adjGmId, doorId: result.adjDoorId, adjRoomId: result.adjRoomId, poly };
    } else {
      console.error(`${gmGraphClass.name}: getOpenDoorArea failed to get context`, { gmIndex: gmId, doorIndex: doorId, hullDoorIndex: hullDoorId });
      return null;
    }
  }

  /**
   * Get union of window with rooms on either side of window.
   * Currently windows cannot connect distinct geomorphs.
   * @param {number} gmId 
   * @param {number} windowId 
   */
  getOpenWindowPolygon(gmId, windowId) {
    const gm = this.gms[gmId];
    const window = gm.windows[windowId];
    const adjRoomNodes = gm.roomGraph.getAdjacentRooms(gm.roomGraph.getWindowNode(windowId));
    return Poly.union(adjRoomNodes.map(x => gm.rooms[x.roomId]).concat(window.poly))[0];
  }

  /** @param {Geom.VectJson[]} points */
  inSameRoom(...points) {
    /** @type {null | Geomorph.GmRoomId} */ let gmRoomId;
    return points.every((point, i) => {
      const next = this.findRoomContaining(point);
      if (!next) return false;
      if (i > 0 && (
        /** @type {Geomorph.GmRoomId} */ (gmRoomId).gmId !== next.gmId ||
        /** @type {Geomorph.GmRoomId} */ (gmRoomId).roomId !== next.roomId
      )) {
        return false;
      }
      return gmRoomId = next;
    });
  }

  /**
   * A hull door can be sealed either by definition,
   * or by virtue of its position (leaf node in gmGraph)
   * @param {number} gmId 
   * @param {number} hullDoorId 
   */
  isHullDoorSealed(gmId, hullDoorId) {
    const doorNode = this.getDoorNodeById(gmId, hullDoorId);
    if (doorNode === null) {
      console.warn(`hull door node not found: ${JSON.stringify({ gmId, hullDoorId })}`);
      return true;
    }
    return doorNode.sealed;
  }

  /**
   * The only way a
   * @see {gmGraphClass} is constructed.
   * @param {Geomorph.GeomorphDataInstance[]} gms 
   */
  static fromGms(gms) {
    const graph = new gmGraphClass(gms);

    /** @type {Graph.GmGraphNode[]} */
    const nodes = [

      // ℹ️ geomorph nodes are aligned to `gms` for easy access
      ...gms.map(/** @returns {Graph.GmGraphNodeGm} */ (x, gmIndex) => ({
        type: 'gm',
        gmKey: x.key,
        gmIndex,
        id: getGmNodeId(x.key, x.transform),
        transform: x.transform,
      })),

      ...gms.flatMap(({ key: gmKey, hullDoors, transform, pngRect, doors }, gmId) =>
        hullDoors.map(/** @returns {Graph.GmGraphNodeDoor} */ (hullDoor, hullDoorId) => {
          const alongNormal = hullDoor.poly.center.addScaledVector(hullDoor.normal, 20);
          const gmInFront = pngRect.contains(alongNormal);
          const direction = this.computeHullDoorDirection(hullDoor, hullDoorId, transform, gmKey);
          return {
            type: 'door',
            gmKey,
            gmId,
            id: getGmDoorNodeId(gmKey, transform, hullDoorId),
            doorId: doors.indexOf(hullDoor),
            hullDoorId,
            transform,
            gmInFront,
            direction,
            sealed: true, // Overwritten below
          };
        })
      ),
    ];

    graph.registerNodes(nodes);
    // Compute `graph.entry`
    nodes.forEach(node => {
      if (node.type === 'door') {
        const { matrix, doors } = gms[node.gmId];
        // console.log('->', node);
        const nonNullIndex = doors[node.doorId].roomIds.findIndex(x => x !== null);
        const entry = /** @type {Geom.Vect} */ (doors[node.doorId].entries[nonNullIndex]);
        graph.entry.set(node, matrix.transformPoint(entry.clone()));
      }
    });

    // Each gm node is connected to its door nodes (hull doors it has)
    /** @type {Graph.GmGraphEdgeOpts[]} */
    const localEdges = gms.flatMap(({ key: gmKey, hullDoors, transform }) => {
      const gmNodeKey = getGmNodeId(gmKey, transform);
      return hullDoors.map((_, hullDoorIndex) => ({
        src: gmNodeKey,
        dst: getGmDoorNodeId(gmKey, transform, hullDoorIndex),
      }));
    });
    
    // Each door node is connected to the door node it is identified with (if any)
    const globalEdges = gms.flatMap((srcItem, gmId) => {
      /**
       * Detect geomorphs whose gridRects border current one.
       * NOTE wasting some computation because relation is symmetric
       */
      const adjItems = gms.filter((dstItem, dstGmId) => dstGmId !== gmId && dstItem.gridRect.intersects(srcItem.gridRect));
      // console.info('geomorph to geomorph:', srcItem, '-->', adjItems);
      /**
       * For each hull door, detect any intersection with aligned geomorph hull doors.
       * - We use `door.poly.rect` instead of `door.rect` because we apply a transform to it.
       * - Anecdotally, every hull door will be an axis-aligned rect (unlike non-hull doors).
       */
      const [srcRect, dstRect] = [new Rect, new Rect];
      const [srcMatrix, dstMatrix] = [new Mat, new Mat];
      return srcItem.hullDoors.flatMap((srcDoor, hullDoorId) => {
        const srcDoorNodeId = getGmDoorNodeId(srcItem.key, srcItem.transform, hullDoorId);
        srcMatrix.setMatrixValue(srcItem.transform);
        srcRect.copy(srcDoor.poly.rect.applyMatrix(srcMatrix));

        const pairs = adjItems.flatMap(item => item.hullDoors.map(door => /** @type {const} */ ([item, door])));
        const matching = pairs.find(([{ transform }, { poly }]) =>
          srcRect.intersects(dstRect.copy(poly.rect.applyMatrix(dstMatrix.setMatrixValue(transform))))
        );
        if (matching !== undefined) {
          const [dstItem, dstDoor] = matching;
          const dstHullDoorId = dstItem.hullDoors.indexOf(dstDoor);
          // console.info('hull door to hull door:', srcItem, hullDoorId, '==>', dstItem, dstHullDoorId)
          const dstDoorNodeId = getGmDoorNodeId(dstItem.key, dstItem.transform, dstHullDoorId);
          // NOTE door nodes with global edges are not sealed
          graph.getDoorNode(srcDoorNodeId).sealed = false;
          return { src: srcDoorNodeId, dst: dstDoorNodeId };
        } else {
          return [];
        }
      });
    });

    [...localEdges, ...globalEdges].forEach(({ src, dst }) => {
      if (src && dst) {
        graph.connect({ src, dst });
        graph.connect({ src: dst, dst: src });
      }
    });

    return graph;
  }

  /**
   * Works because we'll use a dummy instance where `this.gms` empty.
   */
  get ready() {
    return this.gms.length > 0;
  }
}

/**
 * @param {Geomorph.GeomorphKey} gmKey 
 * @param {[number, number, number, number, number, number]} transform 
 */
function getGmNodeId(gmKey, transform) {
  return `gm-${gmKey}-[${transform}]`;
}

/**
 * @param {Geomorph.GeomorphKey} gmKey 
 * @param {[number, number, number, number, number, number]} transform 
 * @param {number} hullDoorId 
 */
function getGmDoorNodeId(gmKey, transform, hullDoorId) {
  return `door-${gmKey}-[${transform}]-${hullDoorId}`;
}
