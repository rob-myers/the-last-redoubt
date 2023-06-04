import { BinaryHeap } from './BinaryHeap';
import { Utils } from './Utils';

export class AStar {

  /**
   * @param {Graph.BaseGraph<Graph.AStarNode>} graph
   * @param {(nodes: Graph.AStarNode[]) => void} initNodeCosts
   */
  static init (graph, initNodeCosts) {
    const nodes = graph.nodesArray;
    // const metas = graph.nodeToMeta;
    for (let x = 0; x < nodes.length; x++) {
      const node = nodes[x];
      // const meta = metas[x];
      node.f = 0;
      node.g = 0;
      node.h = 0;
      // // Why so large? 1000 didn't work
      // node.cost = doorOpen[meta.nearDoorId ?? meta.doorId] === false ? 10000 : 1.0;
      node.visited = false;
      node.closed = false;
      node.parent = null;
    }
    initNodeCosts(nodes);
  }

  /** @param {Graph.AStarNode[]} graph */
  static cleanUp (graph) {
    for (let x = 0; x < graph.length; x++) {
      const node = /** @type {Partial<Graph.AStarNode>} */ (graph[x]);
      delete node.f;
      delete node.g;
      delete node.h;
      delete node.cost;
      delete node.visited;
      delete node.closed;
      delete node.parent;
    }
  }

  static heap () {
    return new BinaryHeap(
      /** @param {Graph.AStarNode} node */
      function (node) {
        return /** @type {number} */ (node.f);
      }
    );
  }

  /**
   * @template {Graph.AStarNode} T
   * @param {Graph.BaseGraph<Graph.AStarNode>} graph 
   * @param {T} start 
   * @param {T} end 
   * @param {(nodes: Graph.AStarNode[]) => void} initNodeCosts
   * @returns {T[]}
   */
  // static search (graph, start, end, doorOpen) {
  static search (graph, start, end, initNodeCosts) {
    this.init(graph, initNodeCosts);
    //heuristic = heuristic || astar.manhattan;
    const nodes = graph.nodesArray;

    const openHeap = /** @type {BinaryHeap<Graph.AStarNode>} */ (this.heap());
    openHeap.push(start);

    while (openHeap.size() > 0) {

      // Grab the lowest f(x) to process next.  Heap keeps this sorted for us.
      const currentNode = openHeap.pop();

      // End case -- result has been found, return the traced path.
      if (currentNode === end) {
        let curr = currentNode;
        const result = /** @type {T[]} */ ([]);
        while (curr.parent) {
          result.push(/** @type {T} */ (curr));
          curr = curr.parent;
        }
        result.push(start); // We include start
        this.cleanUp(result);
        result.reverse();
        return result;
      }

      // Normal case -- move currentNode from open to closed, process each of its neighbours.
      currentNode.closed = true;

      // Find all neighbours for the current node. Optionally find diagonal neighbours as well (false by default).
      const neighbours = this.neighbours(nodes, currentNode);

      for (let i = 0, il = neighbours.length; i < il; i++) {
        const neighbour = neighbours[i];

        if (neighbour.closed) {
          // Not a valid node to process, skip to next neighbour.
          continue;
        }

        // The g score is the shortest distance from start to current node.
        // We need to check if the path we have arrived at this neighbour is the shortest one we have seen yet.
        const gScore = /** @type {number} */ (currentNode.g) + neighbour.cost;
        const beenVisited = neighbour.visited;

        if (!beenVisited || gScore < /** @type {number} */ (neighbour.g)) {

          // Found an optimal (so far) path to this node.  Take score for node to see how good it is.
          neighbour.visited = true;
          neighbour.parent = currentNode;
          if (!neighbour.centroid || !end.centroid) throw new Error('Unexpected state');
          neighbour.h = neighbour.h || this.heuristic(neighbour.centroid, end.centroid);
          neighbour.g = gScore;
          neighbour.f = neighbour.g + neighbour.h;

          if (!beenVisited) {
            // Pushing to heap will put it in proper place based on the 'f' value.
            openHeap.push(neighbour);
          } else {
            // Already seen the node, but since it has been rescored we need to reorder it in the heap
            openHeap.rescoreElement(neighbour);
          }
        }
      }
    }

    // No result was found - empty array signifies failure to find path.
    return [];
  }

  /**
   * @param {Geom.VectJson} pos1 
   * @param {Geom.VectJson} pos2 
   */
  static heuristic (pos1, pos2) {
    return Utils.distanceToSquared(pos1, pos2);
  }

  /**
   * @param {Graph.AStarNode[]} graph 
   * @param {Graph.AStarNode} node 
   */
  static neighbours (graph, node) {
    const ret = [];
    for (let e = 0; e < node.neighbours.length; e++) {
      ret.push(graph[node.neighbours[e]]);
    }
    return ret;
  }
}
