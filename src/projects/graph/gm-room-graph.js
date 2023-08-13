import { getGmRoomKey } from "../service/geomorph";
import { BaseGraph } from "./graph";

/**
 * @extends {BaseGraph<Graph.GmRoomGraphNode, Graph.GmRoomGraphEdgeOpts>}
 */
export class gmRoomGraphClass extends BaseGraph {

  /**
   * e.g. relDoor[gmId][doorId].doorIds
   * @type {{ doors: Graph.GmDoorId[]; windows: Graph.GmWindowId[]; }[][]}
   */
  relDoor = [];
  
  /**
   * e.g. parallelDoor[gmId][doorId]
   * @type {Graph.GmDoorId[][][]}
   */
  parallelDoor = [];

  /**
   * @param {Graph.GmGraph} gmGraph
   * @returns {Graph.GmRoomGraph}
   */
  static fromGmGraph(gmGraph) {
    // 🚧 relate-connectors
    // 🚧 parallel-connectors

    const graph = new gmRoomGraphClass();

    /** @type {Graph.GmRoomGraphNode[]} */
    const nodes = gmGraph.gms.flatMap((gm, gmId) =>
      gm.rooms.map((_, roomId) => ({
        id: getGmRoomKey(gmId, roomId),
        gmId,
        roomId,
      }))
    );

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

    return graph;
  }
}
