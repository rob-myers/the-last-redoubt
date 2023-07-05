declare namespace Nav {

  export type Graph = GraphNode[];

  export interface GraphNode {
    id: number;
    neighbours: number[];
    f: number;
    g: number;
    h: number;
    cost: number;
    visited: boolean;
    closed: boolean;
    parent: null | GraphNode;
    portals: number[][];
    vertexIds: number[];
    centroid: Geom.VectJson;
  }

  export interface NavPoly {
    vertexIds: number[];
    neighbours: Set<NavPoly>;
    centroid: Geom.VectJson;
    group?: number;
  }

  export interface Zone {
    vertices: Geom.VectJson[];
    groups: GraphNode[][];
  }

  export interface ZoneWithMeta extends Zone {
    /**
     * Aligned to `Geomorph.Layout['doors']`,
     * `doorNodeIds[doorId]` includes all nodeIds whose
     * triangle intersects `doors[doorId].poly`.
     */
    doorNodeIds: number[][];
    /**
     * Aligned to `Geomorph.Layout['rooms']`,
     * `roomNodeIds[roomId]` includes all
     * nodeIds inside outline of room `rooms[roomId]`.
     * - _inside_ means ≥ 2 vertices of triangle lie in room.
     * - we check _rooms_ as opposed to _roomsWithDoors_.
     */
    roomNodeIds: number[][];
    gridSize: number;
    /**
     * Grid coord `⌊x / gridSize⌋`, `⌊y / gridSize⌋` to nav node ids
     * intersecting rect `(x, y, gridSize, gridSize)`.
     */
    // gridToNodeIds: Record<`${number}-${number}`, number[]>;
    gridToNodeIds: Record<number, Record<number, number[]>>;
  }

  export interface SearchContext {
    graph: Graph.FloorGraph;
    /**
     * Node indices known to be closed (i.e. not traversable),
     * e.g. because they correspond to a closed door.
     */
    nodeClosed: Record<number, true>;
  }

}
