import { BaseGraph } from "./graph";

/**
 * @extends {BaseGraph<Graph.GmRoomGraphNode, Graph.GmRoomGraphEdgeOpts>}
 */
export class gmRoomGraphClass extends BaseGraph {

    /**
     * @param {Graph.GmGraph} gmGraph 
     * @returns {Graph.GmRoomGraph}
     */
    static fromGmGraph(gmGraph) {
        const output = new gmRoomGraphClass();
        // 🚧
        return output;
    }
}