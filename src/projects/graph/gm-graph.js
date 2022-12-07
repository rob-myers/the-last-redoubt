import { Mat, Poly, Rect, Vect } from "../geom";
import { BaseGraph } from "./graph";
import { assertNonNull, removeDups } from "../service/generic";
import { geom, directionChars } from "../service/geom";
import { computeLightPosition } from "../service/geomorph";
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
   * @type {{ [gmKey in Geomorph.LayoutKey]?: Geomorph.GeomorphData }}
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
   * TODO 🚧 verify
   * Assume `transform` is non-singular and [±1, ±1, ±1, ±1, x, y]
   * @param {Geomorph.ConnectorRect<Poly, Vect, Rect>} hullDoor
   * @param {number} hullDoorId
   * @param {[number, number, number, number, number, number]} transform
   * @param {Geomorph.LayoutKey} gmKey
   * @returns {null | Geom.Direction}
   */
  static computeHullDoorDirection(hullDoor, hullDoorId, transform, gmKey) {
    const found = hullDoor.tags.find(x => /^hull\-[nesw]$/.test(x));
    if (found) {
      const dirChar = /** @type {typeof directionChars[*]} */ (found.slice(-1));
      const direction = /** @type {Geom.Direction} */ (directionChars.indexOf(dirChar));
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
      error(`hullDoor ${hullDoorId}: ${found}: failed to parse transform "${transform}"`);
    } else {
      error(`${gmKey}: hullDoor ${hullDoorId}: expected tag "hull-{n,e,s,w}" in hull door`);
    }
    return null;
  }

  /**
   * Compute lit area, determined by current room and open doors.
   * @param {number} gmId 
   * @param {number} rootRoomId 
   * @returns {Poly[][]}
   */
  computeDoorLights(gmId, rootRoomId) {
    const openDoorsIds = this.api.doors.getOpen(gmId);

    /** Ids of open doors connected to rootRoom */
    const doorIds = this.gms[gmId].roomGraph.getAdjacentDoors(rootRoomId).flatMap(
      ({ doorId }) => openDoorsIds.includes(doorId) ? doorId : []
    );
    /**
     * Each area is constructed by joining 2 roomWithDoors,
     * i.e. either side of the door corresponding to `doorId`.
     */
    const doorLightAreas = doorIds.flatMap((doorId) =>
      this.computeDoorLightArea(gmId, doorId, openDoorsIds, doorIds)??[]
    );
    /**
     * For each area we raycast a light from specific position.
     */
    const unjoinedLights = doorLightAreas.flatMap(({ area, relDoorIds }) => {
      /**
       * These additional line segments are needed when 2 doors
       * adjoin a single room e.g. double doors.
       * _TODO_ use fewer segments
       */
      const closedDoorSegs = this.gms[area.gmId].doors.filter((_, id) =>
        id !== area.doorId && !relDoorIds.includes(id)
      ).map(x => x.seg);

      return {
        gmId: area.gmId,
        poly: geom.lightPolygon({
          position: this.getDoorLightPosition(area.gmId, rootRoomId, area.doorId),
          range: 2000,
          exterior: area.poly,
          extraSegs: closedDoorSegs,
        }),
      };
    });

    return this.gms.map((_, gmId) =>
      unjoinedLights.filter(x => x.gmId === gmId).map(x => x.poly.precision(precision))
    );
  }

  /**
   * @param {number} gmId 
   * @param {number} doorId 
   * @param {number[]} openDoorIds 
   * @param {number[]} adjOpenDoorIds 
   */
  computeDoorLightArea(gmId, doorId, openDoorIds, adjOpenDoorIds) {
    const gm = this.gms[gmId];
    const area = this.getOpenDoorArea(gmId, doorId);
    if (!area) {
      return null;
    }

    /**
     * - Originally, `relate-connectors` tag induced a relation between doorIds.
     *   We _extend_ light area when exactly one of them is in @see adjOpenDoorIds.
     * - Light is extended through a door in an adjacent room, non-adjacent to current room.
     * - _TODO_ test relations R(doorId, windowId)
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
   * Compute lit area, determined by current room, open doors, and windows.
   * @param {number} gmId 
   * @param {number} rootRoomId 
   * @returns {Poly[][]}
   */
  computeLightPolygons(gmId, rootRoomId) {
    const doorLights = this.computeDoorLights(gmId, rootRoomId);
    const windowLights = this.computeWindowLights(gmId, rootRoomId);
    return doorLights.map((lights, i) => lights.concat(windowLights[i])); // Zipped
  }

  /**
   * Compute lit area, determined by current room and open windows.
   * @param {number} gmId 
   * @param {number} rootRoomId 
   * @returns {Poly[][]}
   */
  computeWindowLights(gmId, rootRoomId) {
    const gm = this.gms[gmId];

    const windowIds = gm.roomGraph.getAdjacentWindows(rootRoomId).filter(x => {
      const connector = gm.windows[x.windowId];
        // Frosted windows opaque
        if (connector.tags.includes('frosted')) return false;
        // One-way mirror
        if (connector.tags.includes('one-way') && connector.roomIds[0] !== rootRoomId) return false;
        return true;
    }).map(x => x.windowId);

    const unjoinedLights = windowIds.map(windowId => ({
      gmId,
      poly: geom.lightPolygon({
        position: (
          gm.point[rootRoomId]?.windowLight[windowId]
          // We move light inside current room
          || computeLightPosition(gm.windows[windowId], rootRoomId, lightWindowOffset)
        ),
        range: 1000,
        exterior: this.getOpenWindowPolygon(gmId, windowId),
      }),
    }));

    return this.gms.map((_, gmId) =>
      unjoinedLights.filter(x => x.gmId === gmId).map(x => x.poly.precision(2))
    );
  }

  /**
   * Find path using simplistic global nav strategy.
   * @param {Geom.VectJson} src
   * @param {Geom.VectJson} dst 
   */
  findPath(src, dst) {
    const srcGmId = this.gms.findIndex(x => x.gridRect.contains(src));
    const dstGmId = this.gms.findIndex(x => x.gridRect.contains(dst));
    if (srcGmId === -1 || dstGmId === -1) {
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
       * This is a rather simplistic strategy, and depends on the
       * respective topology being "nice". However, we would expect
       * the Last Redoubt to use up as much space as possible.
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

  /** @param {Geom.VectJson} point */
  findRoomContaining(point) {
    const gmId = this.gms.findIndex(gm => gm.gridRect.contains(point));
    if (gmId === -1) {
      return null;
    }
    const gm = this.gms[gmId];
    const localPoint = new Vect;
    const roomId = gm.rooms.findIndex(room => room.contains(
      gm.inverseMatrix.transformPoint(localPoint.copy(point))
    ));
    return roomId === -1 ? null : { gmId, roomId };
  }

  /**
   * Works because we'll use a dummy instance where `this.gms` empty.
   */
  get ready() {
    return this.gms.length > 0;
  }

  /**
   * @param {Graph.GmGraphNode} node 
   */
  getAdjacentDoor(node) {
    const doorNode = this.getSuccs(node).find(x => x.type === 'door');
    return doorNode ? /** @type {Graph.GmGraphNodeDoor} */ (doorNode) : null
  }

  /**
   * Given ids of rooms in gmGraph, provide "adjacency data".
   * - We do include rooms adjacent via a door or non-frosted window.
   * - We handle dup roomIds e.g. via double doors.
   * - We don't ensure input roomIds are output.
   *   However they're included if they're adjacent to another such input roomId.
   * @param {{ gmId: number; roomId: number; }[]} roomIds
   * @returns {Graph.GmRoomsAdjData}
   */
  getRoomIdsAdjData(roomIds) {
    const output = /** @type {Graph.GmRoomsAdjData} */ ({});

    for (const { gmId, roomId } of roomIds) {
      const gm = this.gms[gmId];
      const openDoorIds = this.api.doors.getOpen(gmId);
      // Non-hull doors or windows induce an adjacent room
      output[gmId] = output[gmId] || { roomIds: [], windowIds: [], closedDoorIds: [] };
      output[gmId].roomIds.push(...gm.roomGraph.getOpenRoomIds(roomId, openDoorIds));
      output[gmId].windowIds.push(...gm.roomGraph.getAdjacentWindows(roomId).flatMap(x => gm.windows[x.windowId].tags.includes('frosted') ? [] : x.windowId));
      output[gmId].closedDoorIds.push(...gm.roomGraph.getAdjacentDoors(roomId).flatMap(x => openDoorIds.includes(x.doorId) ? [] : x.doorId));
      // Connected hull doors induce room in another geomorph
      // NOTE we currently ignore hull windows 
      const hullDoorIds = gm.roomGraph.getAdjacentHullDoorIds(gm, roomId);
      hullDoorIds
        .filter(({ hullDoorId }) => !this.isHullDoorSealed(gmId, hullDoorId))
        .forEach(({ hullDoorId }) => {
          const ctxt = assertNonNull(this.getAdjacentRoomCtxt(gmId, hullDoorId));
          output[ctxt.adjGmId] = output[ctxt.adjGmId] || { roomIds: [], windowIds: [], closedDoorIds: [] };
          output[ctxt.adjGmId].roomIds.push(ctxt.adjRoomId);
        });
    }

    Object.values(output).forEach(x => x.roomIds = removeDups(x.roomIds));
    return output;
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

  /** @param {Graph.GmGraphNodeDoor} doorNode */
  getDoorEntry(doorNode) {
    return /** @type {Geom.Vect} */ (this.entry.get(doorNode));
  }

  /**
   * By default we move light inside current room by constant amount.
   * Sometimes this breaks (lies outside current room) or looks bad when combined,
   * so can override via 'light' tagged rects.
   * @param {number} gmId
   * @param {number} rootRoomId
   * @param {number} doorId
   */
  getDoorLightPosition(gmId, rootRoomId, doorId, permitReversed = true) {
    const gm = this.gms[gmId];
    // Seems some geomorphs lack gm.point[x]
    const custom = gm.point[rootRoomId]?.doorLight[doorId];
    return (
      custom && (permitReversed || !custom.tags.includes('reverse'))
        ? custom.point.clone()
        : computeLightPosition(gm.doors[doorId], rootRoomId, lightDoorOffset)
    );
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
  getDoorNodeByIds(gmId, hullDoorId) {
    const gm = this.gms[gmId];
    const nodeId = getGmDoorNodeId(gm.key, gm.transform, hullDoorId);
    return /** @type {Graph.GmGraphNodeDoor} */ (this.getNodeById(nodeId));
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
    const hullDoorId = gm.hullDoors.indexOf(door);

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

  /**
   * @param {number} gmId 
   * @param {number} hullDoorId 
   */
  isHullDoorSealed(gmId, hullDoorId) {
    const doorNode = this.getDoorNodeByIds(gmId, hullDoorId);
    if (doorNode === null) {
      console.warn(`hull door not found`, gmId, hullDoorId);
      return true;
    }
    return this.getDoorNodeByIds(gmId, hullDoorId).sealed;
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

      // NOTE geomorph nodes are aligned to `gms` for easy access
      ...gms.map((x, gmIndex) => {
        /** @type {Graph.GmGraphNodeGm} */
        const gmNode = {
          type: 'gm',
          gmKey: x.key,
          gmIndex,
          id: getGmNodeId(x.key, x.transform),
          transform: x.transform,
        };
        return gmNode;        
      }),

      ...gms.flatMap(({ key: gmKey, hullDoors, transform, pngRect, doors }, gmId) => {
        return hullDoors.map((hullDoor, hullDoorId) => {
          const alongNormal = hullDoor.poly.center.addScaledVector(hullDoor.normal, 20);
          const gmInFront = pngRect.contains(alongNormal);
          const direction = this.computeHullDoorDirection(hullDoor, hullDoorId, transform, gmKey);

          /** @type {Graph.GmGraphNodeDoor} */
          const doorNode = {
            type: 'door',
            gmKey,
            gmId,
            id: getGmDoorNodeId(gmKey, transform, hullDoorId),
            doorId: doors.indexOf(hullDoor),
            hullDoorId,
            transform,
            gmInFront,
            direction,
            sealed: true, // Overwritten further below
          };
          return doorNode;
        })
      }),
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
}

/**
 * @param {Geomorph.LayoutKey} gmKey 
 * @param {[number, number, number, number, number, number]} transform 
 */
function getGmNodeId(gmKey, transform) {
  return `gm-${gmKey}-[${transform}]`;
}

/**
 * @param {Geomorph.LayoutKey} gmKey 
 * @param {[number, number, number, number, number, number]} transform 
 * @param {number} hullDoorId 
 */
function getGmDoorNodeId(gmKey, transform, hullDoorId) {
  return `door-${gmKey}-[${transform}]-${hullDoorId}`;
}
