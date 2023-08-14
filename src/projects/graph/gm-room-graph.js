import { mapValues } from "../service/generic";
import { getGmRoomKey } from "../service/geomorph";
import { BaseGraph } from "./graph";

/**
 * @extends {BaseGraph<Graph.GmRoomGraphNode, Graph.GmRoomGraphEdgeOpts>}
 */
export class gmRoomGraphClass extends BaseGraph {

  api = /** @type {import('../world/World').State} */  ({
    isReady() { return false; },
  });

  /**
   * 🤔 optional GmDoorId.parallelDoorIds?
   * e.g. relDoor[gmId][doorId]?.doorIds
   * @type {{ [doorId: number]: { doors: Graph.GmDoorId[]; windows: Graph.GmWindowId[]; }}[]}
   */
  relDoor = [];

  /**
   * `gmNodeOffset[gmId]` is index of 1st node originally from `gmId`
   * @type {number[]}
   */
  gmNodeOffset = [];

  /**
   * Get `GmDoorId`s of doors connecting two gmRoomIds, if any.
   * @param {Geomorph.GmRoomId} srcRm 
   * @param {Geomorph.GmRoomId} dstRm 
   * @returns {Graph.GmDoorId[]}
   */
  getAdjGmDoorIds(srcRm, dstRm, requireOpen = false) {
    const src = this.getNode(srcRm.gmId, srcRm.roomId);
    const dst = this.getNode(dstRm.gmId, dstRm.roomId);
    const doors = this.succ.get(src)?.get(dst)?.doors ?? [];
    if (requireOpen) {
      const doorApi = this.api.doors;
      return doors.filter(p => doorApi.isOpen(p.gmId, p.doorId));
    } else {
      return doors;
    }
  }

  /**
   * @param {number} gmId 
   * @param {number} roomId 
   */
  getNode(gmId, roomId) {
    return this.nodesArray[this.gmNodeOffset[gmId] + roomId];
  }

  /**
   * @param {Graph.GmGraph} gmGraph
   * @returns {Graph.GmRoomGraph}
   */
  static fromGmGraph(gmGraph) {

    const graph = new gmRoomGraphClass();

    /** @type {Graph.GmRoomGraphNode[]} */
    const nodes = gmGraph.gms.flatMap((gm, gmId) =>
      gm.rooms.map((_, roomId) => ({
        id: getGmRoomKey(gmId, roomId),
        gmId,
        roomId,
      }))
    );

    // For fast node lookup
    graph.gmNodeOffset = gmGraph.gms.reduce((agg, gm, gmId) => {
      agg[gmId] = gmId === 0 ? 0 : agg[gmId - 1] + gm.rooms.length;
      return agg;
    }, /** @type {typeof graph.gmNodeOffset} */ ([]));

    graph.registerNodes(nodes);

    // Edges: for fixed gmId
    // Edges: bridging two gmIds (via hull doors)
    gmGraph.gms.forEach((gm, gmId) => {
      gm.rooms.forEach((_, roomId) => {
        /** @type {Geomorph.GmRoomId} */ let gmRoomId;

        const succ = gm.roomGraph.getAdjacentDoors(roomId).reduce(
          (agg, { doorId }) => {
            if (gm.isHullDoor(doorId)) {
              const ctxt = gmGraph.getAdjacentRoomCtxt(gmId, doorId);
              if (ctxt) {
                (agg[JSON.stringify(gmRoomId = { gmId: ctxt.adjGmId, roomId: ctxt.adjRoomId })] ??= [[], []])[0].push(
                  { gmId, doorId, other: { gmId: ctxt.adjGmId, doorId: ctxt.adjDoorId } }
                );
              } // ctxt `null` for unconnected hull doors
            } else {
              const otherRoomId = /** @type {number} */ (gm.getOtherRoomId(doorId, roomId));
              (agg[JSON.stringify(gmRoomId = { gmId, roomId: otherRoomId })] ??= [[], []])[0].push(
                { gmId, doorId },
              );
            }
            return agg;
          },
          /** @type {{ [gmRoomId: string]: [Graph.GmDoorId[], Graph.GmWindowId[]] }} */ ({}),
        );

        gm.roomGraph.getAdjacentWindows(roomId).forEach(({ windowId }) => {
          const otherRoomId = gm.windows[windowId].roomIds.find(x => x !== roomId);
          typeof otherRoomId === 'number' && (
            succ[JSON.stringify(gmRoomId = { gmId, roomId: otherRoomId })] ??= [[], []]
          )[1].push({ gmId, windowId });
        });

        const srcKey = getGmRoomKey(gmId, roomId);
        for (const [gmRoomStr, [gmDoorIds, gmWindowIds]] of Object.entries(succ)) {
          const gmRoomId = /** @type {Geomorph.GmRoomId} */ (JSON.parse(gmRoomStr));
          /**
           * This graph is not symmetric i.e. it is a directed graph but not an undirected graph.
           * In particular, edge.doors can differ when src !== dst is a hull room:
           * - `src --edge.doors--> dst`
           * - `dst --edge.doors--> src`
           */
          graph.connect({
            src: srcKey,
            dst: getGmRoomKey(gmRoomId.gmId, gmRoomId.roomId),
            doors: gmDoorIds,
            windows: gmWindowIds,
          })
        }
      })
    });

    // relDoor[gmId] contains gm.relDoor
    // relDoor also contains relations with "other hull door"
    /** @type {typeof graph.relDoor} */
    const extras = gmGraph.gms.map(_ => ({}));
    gmGraph.gms.forEach((gm, gmId) => {
      graph.relDoor[gmId] = mapValues(gm.relDoorId, ({ doorIds, windowIds }, doorIdStr) => {
        return {
          doors: doorIds.flatMap(relDoorId => {
            if (gm.isHullDoor(relDoorId)) {
              const ctxt = gmGraph.getAdjacentRoomCtxt(gmId, relDoorId);
              if (ctxt) {// Store converse relation from identified hull door for later:
                (extras[ctxt.adjGmId][ctxt.adjDoorId] ??= { doors: [], windows: [] }).doors.push({
                  gmId,
                  doorId: Number(doorIdStr),
                  // 🤔 cannot relate hull door to another hull door
                });
                return [
                  { gmId, doorId: relDoorId, other: { gmId: ctxt.adjGmId, doorId: ctxt.adjDoorId } },
                  // Also relate to identified hull door:
                  { gmId: ctxt.adjGmId, doorId: ctxt.adjDoorId, other: { gmId, doorId: relDoorId } },
                ]
              }
            }
            return { gmId, doorId: relDoorId };
          }),
          windows: windowIds.map(windowId => ({ gmId, windowId })),
        };
      });
    });
    extras.forEach((extra, gmId) => {
      Object.entries(extra).forEach(([doorIdStr, { doors, windows }]) => {
        const item = (graph.relDoor[gmId][/** @type {*} */ (doorIdStr)] ??= { doors: [], windows: [] });
        item.doors.push(...doors);
        item.windows.push(...windows);
      });
    });

    return graph;
  }
}
