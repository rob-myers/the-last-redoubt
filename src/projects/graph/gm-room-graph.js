import { getGmRoomKey } from "../service/geomorph";
import { BaseGraph } from "./graph";

/**
 * @extends {BaseGraph<Graph.GmRoomGraphNode, Graph.GmRoomGraphEdgeOpts>}
 */
export class gmRoomGraphClass extends BaseGraph {
  /**
   * @param {Graph.GmGraph} gmGraph
   * @returns {Graph.GmRoomGraph}
   */
  static fromGmGraph(gmGraph) {// 🚧
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
      const { roomGraph } = gm;

      gm.rooms.forEach((_, roomId) => {
        const succ = roomGraph.getAdjacentDoors(roomId).reduce(
          (agg, { doorId }) => {
            /** @type {Geomorph.GmRoomId} */ let gmRoomId;
            if (gm.isHullDoor(doorId)) {
              const ctxt = gmGraph.getAdjacentRoomCtxt(gmId, doorId);
              if (ctxt) {
                (agg[JSON.stringify(gmRoomId = { gmId: ctxt.adjGmId, roomId: ctxt.adjRoomId })] ??= []).push(
                  { gmId, doorId, other: { gmId: ctxt.adjGmId, doorId: ctxt.adjDoorId } }
                );
              } // ctxt `null` for unconnected hull doors
            } else {
              const otherRoomId = /** @type {number} */ (gm.getOtherRoomId(doorId, roomId));
              (agg[JSON.stringify(gmRoomId = { gmId, roomId: otherRoomId })] ??= []).push(
                { gmId, doorId },
              );
            }
            return agg;
          },
          /** @type {{ [gmRoomId: string]: Graph.GmDoorId[] }} */ ({}),
        );

        const srcKey = getGmRoomKey(gmId, roomId);
        for (const [gmRoomStr, gmDoorIds] of Object.entries(succ)) {
          const gmRoomId = /** @type {Geomorph.GmRoomId} */ (JSON.parse(gmRoomStr));
          /**
           * This graph is not symmetric i.e. it is directed graph but not an undirected graph.
           * In particular, edge.doors differs in:
           * - `src --edge.doors--> dst`
           * - `dst --edge.doors--> src`
           */
          graph.connect({
            src: srcKey,
            dst: getGmRoomKey(gmRoomId.gmId, gmRoomId.roomId),
            doors: gmDoorIds,
          })
        }
      })
    });

    return graph;
  }
}
