import { Mat, Poly, Rect, Vect } from "../geom";
import { BaseGraph, createBaseAstar } from "./graph";
import { assertNonNull, removeDups } from "../service/generic";
import { geom, directionChars, isDirectionChar } from "../service/geom";
import { getConnectorOtherSide } from "../service/geomorph";
import { error, warn } from "../service/log";
import { AStar } from "../pathfinding/AStar";

/**
 * Geomorph Graph i.e. a graph whose nodes are geomorphs or hull doors.
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
   * Each array is ordered by `node.rect.area` (ascending), so a
   * larger navmesh does not override a smaller one (e.g. 102)
   * @type {{ [gmId: number]: Graph.GmGraphNodeGm[] }}
   */
  gmNodeByGmId;
  /**
   * A gm node needn't see all hull doors in the geomorph e.g. 102
   * @type {{ [gmId: number]: Graph.GmGraphNodeDoor[] }}
   */
  doorNodeByGmId;

  /**
   * World coordinates of entrypoint to hull door nodes.
   * @type {Map<Graph.GmGraphNodeDoor, Geom.Vect>}
   */
  entry;

  api = /** @type {import('../world/World').State} */  ({
    isReady() { return false; },
  });

  /**
   * Cache for @see {getAdjacentRoomCtxt}
   * 🤔 could precompute?
   * @type {Record<`${number}-${number}`, Graph.GmAdjRoomCtxt | null>}
   */
  adjRoomCtxt = {};

  /** @param {Geomorph.GeomorphDataInstance[]} gms  */
  constructor(gms) {
    super();
    this.gms = gms;
    this.gmData = gms.reduce((agg, gm) => ({ ...agg, [gm.key]: gm }), {});
    this.entry = new Map;
    this.gmNodeByGmId = gms.reduce((agg, _, gmId) => ({ ...agg, [gmId]: [] }), {});
    this.doorNodeByGmId = gms.reduce((agg, _, gmId) => ({ ...agg, [gmId]: [] }), {});
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
        if (ime2.x === -1) // (0, 1, -1, 0)
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
   * @returns {Poly[][]}
   */
  computeViews(gmId, rootRoomId) {
    const doorViews = this.computeViewsFromDoors(gmId, rootRoomId);
    const windowViews = this.computeViewWindowAreas(gmId, rootRoomId);

    const viewPolys = doorViews.map((polys, gmId) => polys.concat(windowViews[gmId]));
    viewPolys[gmId].push(this.gms[gmId].roomsWithDoors[rootRoomId]);

    /**
     * Try to eliminate "small black triangular polys", arising from intersecting
     * view polys. Side effect: intermediate walls can become black.
     */
    return viewPolys.map(polys => Poly.unionSafe(polys).map(x => x.removeHoles()));
    // return viewPolys.map(polys => Poly.unionSafe(polys).map(x => x));
  }

  /**
   * Compute viewable areas determined by current room and open doors.
   * @param {number} gmId 
   * @param {number} rootRoomId 
   * @returns {Poly[][]}
   */
  computeViewsFromDoors(gmId, rootRoomId) {
    const gm = this.gms[gmId];
    const gmOpenIds = this.api.doors.getOpenIds(gmId);

    /** Ids of open doors connected to rootRoom */
    const rootOpenIds = gm.roomGraph.getAdjacentDoors(rootRoomId).flatMap(
      ({ doorId }) => gmOpenIds.includes(doorId) ? doorId : []
    );

    const rootGmRoomId = { gmId, roomId: rootRoomId };

    /**
     * Each area is initially constructed by joining two items from
     * `roomWithDoors` i.e. either side of door `doorId`.
     * - `area.gmId` is either `gmId` (non-hull door) or `adjGmId` (hull door).
     * - `area.poly` is local to the respective geomorph.
     * - `area.poly` may be extended via related doorIds.
     */
    const viewDoorAreas = rootOpenIds.flatMap((doorId) =>
      this.computeViewDoorAreas(rootGmRoomId, doorId, rootOpenIds)
    );

    /** For each area we raycast a light from specific position. */
    const unjoinedViews = viewDoorAreas.flatMap(area => {
      /**
       * We need additional line segments for:
       * - doors parallel to `area.doorId`
       * - closed doors related to `area.doorId`
       *
       * They prevent light going through closed parallel doors, and
       * unsightly light patterns through open doors.
       * Parallel doors can be over-approx via roomGraph.getAdjacentDoors,
       * but we prefer an explicit approach.
       */
      const areaGm = this.gms[area.gmId];
      const relDoorIds = areaGm.getRelatedDoorIds(area.doorId);
      const doorLookup = this.api.doors.lookup[area.gmId];
      const blockedDoorIds = [
        // Doors parallel to "view door"
        ...(areaGm.parallelDoorId[area.doorId]?.doors ?? []),
        // Closed doors related to "view door"
        ...relDoorIds.filter(doorId => !doorLookup[doorId].open),
        // Doors parallel to a door related to "view door", but not directly related
        ...relDoorIds.flatMap(relDoorId => areaGm.getParallelDoorIds(relDoorId))
          .filter(x => !relDoorIds.includes(x)),
      ];
      // ℹ️ Maximal possible blocked door ids
      // const blockedDoorIds = areaGm.doors.map((_, doorId) => doorId).filter(doorId =>
      //   doorId !== area.doorId && !(relDoorIds.includes(doorId) && doorLookup[doorId].open)
      // );

      // 🚧 clarify `viewPos` and `getConnectorOtherSide`
      // 🚧 clean `area.otherDoorId ?? area.doorId`

      /** We imagine we are viewing from the center of the door */
      const viewPos = areaGm.doors[area.doorId].poly.center;
      // These segs are not perfect i.e. part of door will be covered
      const extraSegs = blockedDoorIds.map(doorId => getConnectorOtherSide(areaGm.doors[doorId], viewPos));


      const areaRoomId = area.hullRoomId ?? rootRoomId;

      const viewPosition = areaGm.getViewDoorPosition(
        areaRoomId,
        area.doorId,
      );

      return {
        gmId: area.gmId,
        poly: geom.lightPolygon({
          position: viewPosition,
          range: 2000,
          exterior: area.poly,
          extraSegs,
        }),
      };
    });

    /**
     * Use high precision to avoid occasional "Unable to complete output ring"
     * > https://github.com/Turfjs/turf/issues/2048
     */
    return this.gms.map((_, gmId) =>
      unjoinedViews.filter(x => x.gmId === gmId).map(x => x.poly.precision(8))
    );
  }

  /**
   * Compute "basic" symmetric area through specific (possibly hull) door.
   * 
   * For non-hull doors:
   * - output gmId is input gmId.
   * - area is union of roomsWithDoors on either side of door.
   *
   * For hull doors:
   * - output gmId is adjacent gmId
   * - area is union of roomsWithDoors on either side (one from each geomorph),
   *   transformed into adjacent gmId coords
   * @param {Geomorph.GmRoomId} gmRoomId 
   * @param {number} doorId
   * @returns {null | Graph.OpenDoorArea}
   */
  computeViewDoorArea({ gmId, roomId }, doorId) {
    const gm = this.gms[gmId];

    if (!gm.isHullDoor(doorId)) {
      return {
        gmId,
        doorId,
        hullRoomId: null,
        otherDoorId: null,
        poly: gm.roomsWithDoors[roomId],
      };
    }

    const adjCtxt = this.getAdjacentRoomCtxt(gmId, doorId);
    if (!adjCtxt) {
      return null;
    }

    const otherGm = this.gms[adjCtxt.adjGmId];
    const otherGmRoom = otherGm.roomsWithDoors[adjCtxt.adjRoomId];
    // const otherGmRoomSansHoles = new Poly(otherGm.roomsWithDoors[result.adjRoomId].outline);
    const poly = Poly.union([// We transform poly from `gm` coords to `otherGm` coords
      otherGmRoom, // 🚧 get from `roomId` instead?
    ])[0];

    return {
      gmId: adjCtxt.adjGmId,
      doorId: adjCtxt.adjDoorId,
      hullRoomId: adjCtxt.adjRoomId,
      otherDoorId: doorId,
      poly,
    };
  }

  /**
   * Compute viewable area through specific (possibly hull) door.
   * This over-approximates the view i.e. we'll raycast into this.
   * @param {Geomorph.GmRoomId} rootGmRoomId 
   * @param {number} doorId 
   * @param {number[]} rootOpenIds open door in root room
   * @returns {Graph.OpenDoorArea[]}
   */
  computeViewDoorAreas(rootGmRoomId, doorId, rootOpenIds) {
    const gm = this.gms[rootGmRoomId.gmId];
    const area = this.computeViewDoorArea({
      gmId: rootGmRoomId.gmId,
      roomId: gm.getOtherRoomId(doorId, rootGmRoomId.roomId),
    }, doorId);
    if (!area) {
      return [];
    }

    /**
     * - Our SVG symbol's `relate-connectors` tagged rects
     *   induce a relation R(doorId, doorId) and R(doorId, windowId)
     * - We extend the view area when exactly one of x, y
     *   in R(x, y) is in @see {rootOpenIds}.
     * - The view is extended through a door in an adjacent room,
     *   non-adjacent to current room.
     */
    if (gm.isHullDoor(doorId)) {// area.gmId is adjacent to gmId
      const relDoorIds = (this.gms[area.gmId].relDoorId[area.doorId]?.doors ?? []).filter(relDoorId =>
        this.api.doors.lookup[area.gmId][relDoorId].open
      );
      // Handle R(hullDoorId, doorId) by extending area.poly (in adjGm)
      area.poly = Poly.union([
        area.poly,
        ...relDoorIds.flatMap(relDoorId => this.computeViewDoorArea({
          gmId: area.gmId,
          roomId: this.gms[area.gmId].getFurtherDoorRoom(area.doorId, relDoorId),
        }, relDoorId)?.poly ?? []),
        // ...relWindowIds.flatMap(relWindowId => this.getOpenWindowPolygon(gmId, relWindowId)),
      ])[0];
      return [area];

    } else {
      const relItem = gm.relDoorId[doorId];
      const relDoorIds = (relItem?.doors ?? []).filter(relDoorId =>
        this.api.doors.isOpen(rootGmRoomId.gmId, relDoorId)
        && !rootOpenIds.includes(relDoorId)
        // ℹ️ avoid non-contrib relations from creating another poly later
        && !gm.isOtherDoorBehind(rootGmRoomId.roomId, doorId, relDoorId)
        // ℹ️ long relations require intermediate checks 
        && (relItem.metas[relDoorId]?.depIds ?? []).every(x => this.api.doors.isOpen(rootGmRoomId.gmId, x))
      );

      const relNonHullDoorIds = relDoorIds.filter(x => !gm.isHullDoor(x));
      const relHullDoorIds = relDoorIds.filter(x => gm.isHullDoor(x));

      /** Windows are always open, and assumed visible if related door open */
      const relWindowIds = gm.relDoorId[doorId]?.windows ?? [];
  
      if (relDoorIds.length || relWindowIds.length) {
        area.poly = Poly.union([
          area.poly,
          // Related non-hull doors/windows extend area.poly:
          ...relNonHullDoorIds.flatMap(relDoorId =>
            this.computeViewDoorArea({ gmId: rootGmRoomId.gmId, roomId: gm.getFurtherDoorRoom(doorId, relDoorId) }, relDoorId)?.poly || []
          ),
          ...relWindowIds.flatMap(relWindowId => this.getOpenWindowPolygon(rootGmRoomId.gmId, relWindowId)),
        ])[0];
      }
      
      return [area].concat(
        relHullDoorIds.map(// Handle R(doorId, hullDoorId) via `area.poly`s in adjGm
          doorId => /** @type {Graph.OpenDoorArea} */ (this.computeViewDoorArea(rootGmRoomId, doorId)),
        ).filter(Boolean)
      );
    }
  }

  /**
   * Compute viewable areas determined by current room and open windows.
   * @param {number} gmId 
   * @param {number} rootRoomId 
   * @returns {Poly[][]}
   */
  computeViewWindowAreas(gmId, rootRoomId) {
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
        position: gm.getViewWindowPosition(rootRoomId, windowId),
        range: 1000,
        exterior: this.getOpenWindowPolygon(gmId, windowId),
        // 🚧 block all doors?
        // extraSegs: gm.roomGraph.getAdjacentDoors(rootRoomId).map(({ doorId }) => getConnectorOtherSide(gm.doors[doorId], gm.windows[windowId].poly.center)),
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
   * A geomorph can have multiple 'gm' nodes: one per disjoint navmesh.
   * 🚧 Probably split this into two different functions
   * @param {Geom.VectJson} point
   * @returns {[gmId: number | null, gmNodeId: number | null]} respective 'gm' node is `nodesArray[gmNodeId]`
   */
  findGeomorphIdContaining(point) {
    const gmId = this.gms.findIndex(x => x.gridRect.contains(point));
    if (gmId === -1) return [null, null];
    const gmNodeId = this.gmNodeByGmId[gmId].find(node => node.rect.contains(point))?.index;
    return [gmId, gmNodeId ?? null];
  }

  /**
   * Find geomorph edge path using astar.
   * @param {Geom.VectJson} src
   * @param {Geom.VectJson} dst 
   */
  findPath(src, dst) {
    const [srcGmId, srcGmNodeId] = this.findGeomorphIdContaining(src);
    const [dstGmId, dstGmNodeId] = this.findGeomorphIdContaining(dst);
    if (srcGmNodeId === null || dstGmNodeId === null) {
      return null;
    }

    // compute shortest path through gmGraph
    const srcNode = this.nodesArray[srcGmNodeId];
    const dstNode = this.nodesArray[dstGmNodeId];
    const gmPath = AStar.search(this, srcNode, dstNode, (nodes) => {
      nodes[srcNode.index].astar.centroid.copy(src);
      nodes[dstNode.index].astar.centroid.copy(dst);
      // closed hull doors have large cost
      const { lookup } = this.api.doors;
      this.gms.forEach((_, gmId) =>
        this.doorNodeByGmId[gmId].forEach(node => node.astar.cost = lookup[gmId][node.doorId].open === true ? 1 : 10000)
      );
    });

    // convert gmPath to gmEdges
    // gmPath has form: (gm -> door -> door)+ -> gm
    /** @type {Graph.GmGraphNodeDoor} */ let pre;
    /** @type {Graph.GmGraphNodeDoor} */ let post;
    const gmEdges = /** @type {Graph.NavGmTransition[]} */ ([]);
    for (let i = 1; i < gmPath.length; i += 3) {
      pre = /** @type {Graph.GmGraphNodeDoor} */ (gmPath[i]);
      post = /** @type {Graph.GmGraphNodeDoor} */ (gmPath[i + 1]);
      gmEdges.push({
        srcGmId: pre.gmId,
        srcRoomId: /** @type {number} */ (this.gms[pre.gmId].doors[pre.doorId].roomIds.find(x => x !== null)),
        srcDoorId: pre.doorId,
        srcHullDoorId: pre.hullDoorId,
        srcDoorEntry: this.getDoorEntry(pre),

        dstGmId: post.gmId,
        dstRoomId: /** @type {number} */ (this.gms[post.gmId].doors[post.doorId].roomIds.find(x => x !== null)),
        dstDoorId: post.doorId,
        dstHullDoorId: post.hullDoorId,
        dstDoorEntry: this.getDoorEntry(post),
      });
    }

    return gmEdges;
  }

  /**
   * Find geomorph edge path using simplistic global nav strategy.
   * @param {Geom.VectJson} src
   * @param {Geom.VectJson} dst 
   */
  findPathSimplistic(src, dst) {
    const [srcGmId] = this.findGeomorphIdContaining(src);
    const [dstGmId] = this.findGeomorphIdContaining(dst);
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
   * @param {boolean} [includeDoors]
   * Technically rooms do not include doors,
   * but sometimes either adjacent room will do.
   * @returns {null | Geomorph.GmRoomId}
   */
  findRoomContaining(point, includeDoors = false) {
    const [gmId] = this.findGeomorphIdContaining(point);
    if (typeof gmId === 'number') {
      const gm = this.gms[gmId];
      const localPoint = gm.inverseMatrix.transformPoint(Vect.from(point));
      const roomId = gm.findRoomContaining(localPoint, includeDoors);
      return roomId >= 0 ? { gmId, roomId } : null;
    } else {
      return null;
    }
  }

  /**
   * @param {Graph.GmGraphNode} node 
   */
  getAdjacentDoor(node) {
    return this.getSuccs(node).find(
      /** @returns {x is Graph.GmGraphNodeDoor} */ x => x.type === 'door'
    ) ?? null;
  }

  /**
   * @param {number} gmId 
   * @param {number} roomId 
   * @param {number} doorId 
   * @param {boolean} [isHullDoor]
   * @returns {Geomorph.GmRoomId | null}
   */
  getAdjacentGmRoom(gmId, roomId, doorId, isHullDoor = this.gms[gmId].isHullDoor(doorId)) {
    if (isHullDoor) {
      const ctxt = this.getAdjacentRoomCtxt(gmId, doorId);
      return ctxt === null ? null : { gmId: ctxt.adjGmId, roomId: ctxt.adjRoomId };
    } else {
      return { gmId, roomId };
    }
  }

  /**
   * 🚧 simplify?
   * Cached because static and e.g. called many times on toggle hull door.
   * @param {number} gmId 
   * @param {number} hullDoorId 
   * @returns {Graph.GmAdjRoomCtxt | null}
   */
  getAdjacentRoomCtxt(gmId, hullDoorId) {
    const cacheKey = /** @type {const} */ (`${gmId}-${hullDoorId}`);
    if (this.adjRoomCtxt[cacheKey]) {
      return this.adjRoomCtxt[cacheKey];
    }

    const gm = this.gms[gmId];
    const doorNodeId = getGmDoorNodeId(gm.key, gm.transform, hullDoorId);
    const doorNode = this.getNodeById(doorNodeId);
    if (!doorNode) {
      console.error(`${gmGraphClass.name}: failed to find hull door node: ${doorNodeId}`);
      return this.adjRoomCtxt[cacheKey] = null;
    }
    const otherDoorNode = /** @type {undefined | Graph.GmGraphNodeDoor} */ (this.getSuccs(doorNode).find(x => x.type === 'door'));
    if (!otherDoorNode) {
      // console.info(`${gmGraphClass.name}: hull door ${doorNodeId} on boundary`);
      return this.adjRoomCtxt[cacheKey] = null;
    }
    // `door` is a hull door and connected to another
    // console.log({otherDoorNode});
    const { gmId: adjGmId, hullDoorId: dstHullDoorId, doorId: adjDoorId } = otherDoorNode;
    const { roomIds } = this.gms[adjGmId].hullDoors[dstHullDoorId];
    const adjRoomId = /** @type {number} */ (roomIds.find(x => typeof x === 'number'));
    
    return this.adjRoomCtxt[cacheKey] = { adjGmId, adjRoomId, adjHullId: dstHullDoorId, adjDoorId };
  }

  /**
   * @param {Geom.VectJson} position in world coords
   * @param {Geomorph.GmRoomId} [gmRoomId] can specify room
   * @returns {Geom.ClosestOnOutlineResult | null}
   */
  getClosePoint(position, gmRoomId) {
    const gmId = gmRoomId?.gmId ?? this.findGeomorphIdContaining(position)[0];
    if (gmId !== null) {
      const gm = this.gms[gmId];
      const floorGraph = gm.floorGraph;
      gm.inverseMatrix.transformPoint(position = { x: position.x, y: position.y });
      const result = floorGraph.getClosePoint(position, gmRoomId?.roomId);
      result && gm.matrix.transformPoint(result.point);
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
    return this.doorNodeByGmId[gmId].filter(x => !x.sealed && x.direction === sideDir);
  }

  /**
   * Compute every global room id connected to some door,
   * assuming that identified hull doors are respected.
   * @param {number[][]} gmDoorIds `gmDoorIds[gmId]` contains door ids
   * @returns {Geomorph.GmRoomId[]}
   */
  getGmRoomsIdsFromDoorIds(gmDoorIds) {
    const gmRoomIds = /** @type {Geomorph.GmRoomId[]} */ ([]);
    gmDoorIds.forEach((doorIds, gmId) => {
      const gm = this.gms[gmId];
      const seen = /** @type {Record<number, true>} */ ({});
      doorIds.map(doorId => gm.doors[doorId]).forEach(door => {
        door.roomIds.forEach(roomId =>
          // For hull doors, assume adj{GmId,DoorId} occurs elsewhere
          (roomId !== null) && !seen[roomId] && gmRoomIds.push({ gmId, roomId }) && (seen[roomId] = true)
        )
      });
    });
    return gmRoomIds;
  }

  /**
   * Given ids of rooms in gmGraph, provide "adjacency data".
   * - We do include rooms adjacent via a door or non-frosted window.
   * - We handle dup roomIds e.g. via double doors.
   * - We don't ensure input roomIds are output.
   *   However they're included if they're adjacent to another such input roomId.
   * @param {Geomorph.GmRoomId[]} roomIds
   * @param {boolean} [doorsMustBeOpen]
   * @returns {Graph.GmRoomsAdjData}
   */
  getRoomIdsAdjData(roomIds, doorsMustBeOpen = false) {
    const output = /** @type {Graph.GmRoomsAdjData} */ ({});

    for (const { gmId, roomId } of roomIds) {
      const gm = this.gms[gmId];
      const openDoorIds = this.api.doors.getOpenIds(gmId);
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
   * Get door node by `hullDoorId`.
   * @param {number} gmId 
   * @param {number} hullDoorId 
   */
  getDoorNodeById(gmId, hullDoorId) {
    const gm = this.gms[gmId];
    const nodeId = getGmDoorNodeId(gm.key, gm.transform, hullDoorId);
    return /** @type {Graph.GmGraphNodeDoor} */ (this.getNodeById(nodeId));
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
   * Get doorIds visible from `{ gmId, roomId: rootRoomId }` accounting for:
   * - open door/windows
   * - relate-connectors
   * - identified hull-doors
   * - duplicates
   * @param {number} gmId 
   * @param {number} rootRoomId 
   * @returns {Set<number>[]} indexed by gmId
   */
  getViewDoorIds(gmId, rootRoomId) {
    const gm = this.gms[gmId];
    const gmDoors = this.api.doors.lookup[gmId];
    const rootOpenIds = gm.roomGraph.getAdjacentDoors(rootRoomId).flatMap(
      ({ doorId }) => gmDoors[doorId].open ? doorId : []
    );

    const output = this.gms.map((_, id) => gmId === id ? new Set(rootOpenIds): new Set);
    rootOpenIds.forEach((doorId) => {
      if (gm.isHullDoor(doorId)) {
        const { adjGmId, adjDoorId } = /** @type {Graph.GmAdjRoomCtxt} */ (
          this.getAdjacentRoomCtxt(gmId, doorId)
        );
        output[adjGmId].add(adjDoorId); // adjGmId: open related doorIds:
        (this.gms[adjGmId].getRelatedDoorIds(adjDoorId)).filter(relDoorId =>
          this.api.doors.lookup[adjGmId][relDoorId].open
        ).forEach(doorId => output[adjGmId].add(doorId));
      } else {
        const relDoorIds = gm.getRelatedDoorIds(doorId).filter(relDoorId =>
          gmDoors[relDoorId].open
          && !rootOpenIds.includes(relDoorId)
        );
        // gmId: open/new related doorIds
        relDoorIds.forEach(doorId => output[gmId].add(doorId));
        // altGmId: respect hull door identification
        relDoorIds.filter(doorId => gm.isHullDoor(doorId)).forEach(doorId => {
          const { adjGmId, adjDoorId } = /** @type {Graph.GmAdjRoomCtxt} */ (
            this.getAdjacentRoomCtxt(gmId, doorId)
          );
          output[adjGmId].add(adjDoorId);
        });
      }
    });
    return output;
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
   * The only way a @see {gmGraphClass} is constructed.
   * @param {Geomorph.GeomorphDataInstance[]} gms 
   * @param {boolean} [permitErrors] used to keep GeomorphEdit stable
   */
  static fromGms(gms, permitErrors = false) {
    const graph = new gmGraphClass(gms);
    /** Index into nodesArray */
    let index = 0;

    /** @type {Graph.GmGraphNode[]} */
    const nodes = [
      /**
       * nodes are NOT aligned to `gms` because a geomorph
       * may contain multiple disjoint navmeshes e.g. 102
       */
      ...gms.flatMap((gm, gmId) =>
        gm.navPoly.map(/** @returns {Graph.GmGraphNodeGm} */ (navPoly, navGroupId) => ({
          type: 'gm',
          gmKey: gm.key,
          gmId,
          id: getGmNodeId(gm.key, gm.transform, navGroupId),
          transform: gm.transform,

          navGroupId,
          rect: navPoly.rect.applyMatrix(gm.matrix),

          ...createBaseAstar({
            // could change this when starting/ending at a specific geomorph
            centroid: gm.matrix.transformPoint(gm.pngRect.center),
            // neighbours populated further below
          }),
          index: index++,
        }))
      ),

      ...gms.flatMap(({ key: gmKey, hullDoors, matrix, transform, pngRect, doors }, gmId) =>
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

            ...createBaseAstar({
              centroid: matrix.transformPoint(hullDoor.poly.center),
              // neighbours populated further below
            }),
            index: index++,
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
        if (entry) {
          graph.entry.set(node, matrix.transformPoint(entry.clone()));
        } else if (permitErrors) {
          error(`door ${node.doorId} lacks entry`);
        } else {
          throw Error(`${node.gmKey}: door ${node.doorId} lacks entry`);
        }
      }
    });

    graph.nodesArray.forEach(node => // Store for quick lookup
      node.type === 'gm'
        ? graph.gmNodeByGmId[node.gmId].push(node)
        : graph.doorNodeByGmId[node.gmId].push(node)
    );
    // Smaller rects first, otherwise larger overrides (e.g. 102)
    Object.values(graph.gmNodeByGmId).forEach(nodes => nodes.sort(
      (a, b) => a.rect.area < b.rect.area ? -1 : 1
    ));

    // The gm node (gmId, navGroupId) is connected to its door nodes (hull doors it has)
    /** @type {Graph.GmGraphEdgeOpts[]} */
    const localEdges = gms.flatMap(({ key: gmKey, hullDoors, transform }) => {
      return hullDoors.map(({ navGroupId }, hullDoorId) => ({
        src: getGmNodeId(gmKey, transform, navGroupId),
        dst: getGmDoorNodeId(gmKey, transform, hullDoorId),
      }));
    });
    
    // Each door node is connected to the door node it is identified with (if any)
    const globalEdges = gms.flatMap((srcGm, gmId) => {
      /**
       * Detect geomorphs whose gridRects border current one
       * ℹ️ wasting computation because relation is symmetric
       */
      const adjItems = gms.filter((dstGm, dstGmId) => dstGmId !== gmId && dstGm.gridRect.intersects(srcGm.gridRect));
      // console.info('geomorph to geomorph:', srcGm, '-->', adjItems);
      /**
       * For each hull door, detect any intersection with aligned geomorph hull doors.
       * - We use `door.poly.rect` instead of `door.rect` because we apply a transform to it.
       * - Anecdotally, every hull door will be an axis-aligned rect (unlike non-hull doors).
       */
      const [srcRect, dstRect] = [new Rect, new Rect];
      const [srcMatrix, dstMatrix] = [new Mat, new Mat];

      return srcGm.hullDoors.flatMap((srcDoor, hullDoorId) => {
        const srcDoorNodeId = getGmDoorNodeId(srcGm.key, srcGm.transform, hullDoorId);
        srcMatrix.setMatrixValue(srcGm.transform);
        srcRect.copy(srcDoor.poly.rect.applyMatrix(srcMatrix));

        const gmDoorPairs = adjItems.flatMap(gm => gm.hullDoors.map(door => /** @type {const} */ ([gm, door])));
        const matching = gmDoorPairs.find(([{ transform }, { poly }]) =>
          srcRect.intersects(dstRect.copy(poly.rect.applyMatrix(dstMatrix.setMatrixValue(transform))))
        );
        if (matching !== undefined) {// Two hull doors intersect
          const [dstGm, dstDoor] = matching;
          const dstHullDoorId = dstGm.hullDoors.indexOf(dstDoor);
          // console.info('hull door to hull door:', srcItem, hullDoorId, '==>', dstItem, dstHullDoorId)
          const dstDoorNodeId = getGmDoorNodeId(dstGm.key, dstGm.transform, dstHullDoorId);
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

    // Populate node.astar.neighbours
    graph.edgesArray.forEach(({ src, dst }) =>
      src.astar.neighbours.push(dst.index)
    );

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
 * @param {number} navGroupId
 */
function getGmNodeId(gmKey, transform, navGroupId) {
  return `gm-${gmKey}-[${transform}]--${navGroupId}`;
}

/**
 * @param {Geomorph.GeomorphKey} gmKey 
 * @param {[number, number, number, number, number, number]} transform 
 * @param {number} hullDoorId 
 */
function getGmDoorNodeId(gmKey, transform, hullDoorId) {
  return `door-${gmKey}-[${transform}]-${hullDoorId}`;
}
