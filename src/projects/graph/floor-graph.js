import { Vect } from "../geom";
import { BaseGraph, createBaseAstar } from "./graph";
import { Utils } from "../pathfinding/Utils";
import { AStar } from "../pathfinding/AStar";
import { Channel } from "../pathfinding/Channel";
import { warn } from "../service/log";
import { geom } from "../service/geom";
import { coordToNavNodeGrid } from "../service/geomorph";

/**
 * @extends {BaseGraph<Graph.FloorGraphNode, Graph.FloorGraphEdgeOpts>}
 */
export class floorGraphClass extends BaseGraph {

  /** @type {Geomorph.GeomorphData} */
  gm;
  /** @type {Geom.Vect[]} */
  vectors;
  /**
   * Inverse of `doorNodeIds` and `roomToNodeIds`.
   * - We assume no nav node touches > 1 door.
   * - We assume no triangle resides in > 1 room.
   * @type {Record<number, Graph.NavNodeMeta>}
   */
  nodeToMeta;
  /** 
   * Flattened navZone.groups.
   * @type {Nav.GraphNode[]}
   */
  navNodes;
  /**
   * `strictRoomNodeIds[roomId]` are the navNodeIds strictly inside the room,
   * i.e. `navZone.roomNodeIds[roomId]` without nodes near doors.
   * @type {number[][]}
   */
  strictRoomNodeIds;

  static createMock() {
    return new floorGraphClass(/** @type {Geomorph.GeomorphData} */ ({
      navZone: /** @type {Geomorph.GeomorphData['navZone']} */ ({
        vertices: [],
        groups: [],
        doorNodeIds: [],
        roomNodeIds: [],
        gridSize: 0,
        gridToNodeIds: {} }),
    }));
  }

  /**
   * @param {Geomorph.GeomorphData} gm 
   */
  constructor(gm) {
    super();

    this.gm = gm;
    this.vectors = gm.navZone.vertices.map(Vect.from);
    this.navNodes = gm.navZone.groups.flatMap(x => x);
    
    /**
     * Compute `this.nodeToMeta` via `gm.navZone.{doorNodeIds,roomNodeIds}`.
     * Observe that a nodeId can e.g. point to a node in 2nd group.
     */
    this.nodeToMeta = this.navNodes.map((_) => ({ doorId: -1, roomId: -1 }));
    gm.navZone.doorNodeIds.forEach((nodeIds, doorId) => {
      nodeIds.forEach(nodeId => {
        this.nodeToMeta[nodeId].doorId = doorId
        // Actually includes nodes ≤ 2 steps away from one with a doorId
        const twoStepsAwayIds = this.navNodes[nodeId].neighbours.flatMap(otherId => this.navNodes[otherId].neighbours);
        twoStepsAwayIds.forEach(nborId => this.nodeToMeta[nborId].nearDoorId = doorId);
      });
    });
    gm.navZone.roomNodeIds.forEach((nodeIds, roomId) => {
      nodeIds.forEach(nodeId => this.nodeToMeta[nodeId].roomId = roomId);
    });

    this.strictRoomNodeIds = gm.navZone.roomNodeIds.map((nodeIds, roomId) =>
      nodeIds.filter(nodeId => this.nodeToMeta[nodeId].nearDoorId === undefined)
    );
  }

  /**
   * @param {Geom.VectJson} src
   * @param {Geom.VectJson} dst
   * @param {Graph.FloorGraphNode[]} nodePath 
   */
  computeStringPull(src, dst, nodePath) {
    /**
     * Portals correspond to shared vertex-id-pairs along the `nodePath` corridor.
     * The `channel` consists of the respective vertex-pairs.
     */
    const channel = new Channel(nodePath);
    channel.push(src);
    for (let i = 0; i < nodePath.length; i++) {
      const polygon = nodePath[i];
      const nextPolygon = nodePath[i + 1];
      if (nextPolygon) {
        const portals = /** @type {number[]} */ (this.getPortalFromTo(polygon, nextPolygon));
        channel.push(
          this.vectors[portals[0]],
          this.vectors[portals[1]],
        );
      }
    }
    channel.push(dst);
    // We have the corridor, now pull the rope
    channel.stringPull();
    return channel;
  }

  /**
   * Find a path through a geomorph's navmesh
   * @param {Geom.Vect} src in geomorph local coords
   * @param {Geom.Vect} dst in geomorph local coords
   * @param {NPC.NavOpts} [opts]
   * @returns {null | Graph.FloorGraphNavPath}
   */
  findPath(src, dst, opts = {}) {
    const srcNode = this.getClosestNode(src);
    const dstNode = this.getClosestNode(dst);
    if (!srcNode || !dstNode) {
      return null;
    }

    const { doorMeta = [] } = opts;
    /**
     * Apply A-Star implementation originally from:
     * https://github.com/donmccurdy/three-pathfinding/blob/ca62716aa26d78ad8641d6cebb393de49dd70e21/src/Pathfinding.js#L106
     */
    const nodePath = AStar.search(this, srcNode, dstNode, (nodes) => {
      const metas = this.nodeToMeta;
      nodes.forEach((node, i) => {
        node.astar.cost = 1.0;
        const meta = metas[i];
        typeof opts.closedWeight !== 'undefined' && (doorMeta[meta.nearDoorId ?? meta.doorId]?.open === false) && (
          node.astar.cost = /** @type {number} */ (opts.closedWeight)
        );
        typeof opts.lockedWeight !== 'undefined' && (doorMeta[meta.nearDoorId ?? meta.doorId]?.locked === true) && (
          node.astar.cost = /** @type {number} */ (opts.lockedWeight)
        );
      });
    });

    /**
     * Partition of nodePath into alternating lists of door/room nodes.
     */
    const partition = nodePath.reduce((agg, node) => {
      const prev = agg.length ? agg[agg.length - 1] : undefined;
      const meta = this.nodeToMeta[node.index];
      const key = meta.doorId >= 0 ? 'door' : 'room';
      if (prev?.key === key) {
        prev.nodes.push(node);
      } else {
        agg.push(key === 'door'
          ? { key, nodes: [node], doorId: meta.doorId }
          : { key, nodes: [node], roomId: meta.roomId }
        );
        if (key === 'room' && meta.roomId === -1) {
          console.warn(`findPath: expected roomId for node`, node, meta);
        }
      }
      return agg;
    }, /** @type {Graph.NavPartition} */ ([]));

    const path = [src.clone()];
    const fullPartition = /** @type {number[][]} */ ([]);
    /** Last room we entered */
    let lastRoomId = this.nodeToMeta[srcNode.index].roomId;
    const roomIds = /** @type {NPC.LocalNavPath['roomIds']} */ ({ 0: lastRoomId });
    const navMetas = /** @type {Graph.FloorGraphNavPath['navMetas']} */ ([
      { key: 'vertex', index: 0 }, // Cannot be final
    ]);
    let startDoorId = -1, endDoorId = -1;

    /**
     * Add a vertex to nav path, updating `navMetas` and `roomIds`.
     * @param {Geom.Vect} point 
     * @param {number} roomId 
     */
    function addVertex(point, roomId) {
      const index = path.push(point) - 1;
      navMetas.push({ key: 'vertex', index });
      (lastRoomId !== roomId) && (roomIds[index] = lastRoomId = roomId);
    }

    for (const [i, item] of partition.entries()) {
      if (item.key === 'door') {// 🚪 door partition
        const door = this.gm.doors[item.doorId];

        if (i > 0) {// We exited previous room
          const roomId = /** @type {{ roomId: number }} */ (partition[i - 1]).roomId;
          navMetas.splice(-1, 0, {// after any 'vertex' in room
            key: 'exit-room',
            exitedRoomId: roomId,
            index: path.length - 1,
            doorId: item.doorId,
            hullDoorId: this.gm.hullDoors.indexOf(door),
            otherRoomId: door.roomIds[1 - door.roomIds.findIndex(x => x === roomId)],
          });
        } else {
          startDoorId = item.doorId;
        }

        if (!partition[i + 1]) {// Finish in door
          if (!dst.equalsAlmost(path[path.length - 1], 0.01)) {
            // ℹ️ Needed otherwise if turn & re-enter, `enter-room` not triggered
            // ℹ️ Seen almost equal vectors, probably due to augmented precision
            addVertex(dst.clone(), this.nodeToMeta[dstNode.index].roomId);
            fullPartition.push(item.nodes.map(x => x.index));
          }
          endDoorId = item.doorId;
          break;
        } 
        
        const nextRoomId = /** @type {{ roomId: number }} */ (partition[i + 1]).roomId;
        const doorExit = door.entries[door.roomIds.findIndex(x => x === nextRoomId)];
        
        // Avoid case where start by entering geomorph and doorExit ~ src
        if (!(i === 0 && src.distanceTo(doorExit) < 0.1)) {
          addVertex(doorExit.clone(), nextRoomId);
          fullPartition.push(item.nodes.map(x => x.index));
        }

      } else {// 🛏 room partition
        const roomId = item.roomId;

        // Compute endpoints of path through room
        const pathSrc = i === 0 ? src : path[path.length - 1];
        let pathDst = dst;
        if (i < partition.length - 1) {// Given next door node, pathDst should be door entry for roomId
          const door = this.gm.doors[/** @type {{ doorId: number }} */ (partition[i + 1]).doorId];
          pathDst = door.entries[door.roomIds.findIndex(x => x === roomId)];
        }

        if (i > 0) {// We entered this room
          const doorId = /** @type {{ doorId: number }} */ (partition[i - 1]).doorId;
          const door = this.gm.doors[doorId];

          navMetas.push({// before any 'vertex' in room
            key: 'enter-room',
            index: path.length - 1,
            doorId,
            hullDoorId: this.gm.hullDoors.indexOf(door),
            enteredRoomId: roomId,
            otherRoomId: door.roomIds[1 - door.roomIds.findIndex(x => x === roomId)],
          });
        }

        const roomNavPoly = this.gm.lazy.roomNavPoly[roomId];
        const directPath = !geom.lineSegCrossesPolygon(pathSrc, pathDst, roomNavPoly);
        if (directPath) {
          // We can simply walk straight through the room
          addVertex(pathDst.clone(), roomId);
          fullPartition.push(item.nodes.map(x => x.index));
        } else {
          // Otherwise apply "simple stupid funnel algorithm" to path through room
          const channel = this.computeStringPull(pathSrc, pathDst, item.nodes);
          const stringPull = /** @type {Geom.VectJson[]} */ (channel.path).map(Vect.from);
          // We remove adjacent repetitions (which can occur)
          geom.removePathReps(stringPull.slice(1)).forEach(p => addVertex(p, roomId));
          fullPartition.push(...channel.nodePartition);
        }

        // if (!partition[i + 1]) // Finish in room

        const { nearDoorId } = this.nodeToMeta[item.nodes[item.nodes.length - 1].index];
        if (typeof nearDoorId === 'number') {
          // either `partition[i + 1]` exists (door nodes), or we ended near a door
          const door = this.gm.doors[nearDoorId];
          navMetas.splice(-1, 0, {// Ensure last meta is { key: 'vertex' }
            key: 'at-door',
            index: path.length - 1,
            doorId: nearDoorId,
            // Below needed?
            hullDoorId: this.gm.hullDoors.indexOf(door),
            currentRoomId: roomId,
            otherRoomId: door.roomIds[1 - door.roomIds.findIndex(x => x === roomId)],
          });
        }
      }
    }

    // 🚧 DEBUG
    console.warn('floorGraph findPath', {
      nodePath,
      nodeMetas: nodePath.map(x => this.nodeToMeta[x.index]),
      partition, // nav nodes grouped by door/room (alternates)
      path,
      fullPartition, // nav nodes grouped by path-edges
      navMetas,
      roomIds,
    });

    return {
      path, // May contain adjacent dups
      partition: fullPartition,
      navMetas,
      doorIds: [
        startDoorId >= 0 ? { id: startDoorId, hull: this.gm.isHullDoor(startDoorId) } : null,
        endDoorId >= 0 ? { id: endDoorId, hull: this.gm.isHullDoor(endDoorId) } : null,
      ],
      roomIds,
    };
  }

  /**
   * We assume `gm.navZone` has exactly one group,
   * i.e. floor of geomorph (sans doors) is connected.
   * @param {Geomorph.GeomorphData} gm
   * @returns {Graph.FloorGraph}
   */
  static fromZone(gm) {
    const graph = new floorGraphClass(gm);
    
    for (const [nodeId, node] of Object.entries(graph.navNodes)) {
      graph.registerNode({
        type: 'tri',
        id: `tri-${nodeId}`,
        index: Number(nodeId),
        vertexIds: node.vertexIds.slice(),
        portals: node.portals.map(x => x.slice()),

        ...createBaseAstar({
          neighbours: node.neighbours.slice(),
          centroid: Vect.from(node.centroid),
        }),
      });
    }

    for (const [nodeId, node] of Object.entries(graph.navNodes)) {
      const graphNodeId = `tri-${nodeId}`;
      const neighbourIds = node.neighbours.map(otherNodeId => `tri-${otherNodeId}`);
      // Nav.Zone already "symmetric", so no need for double edges
      neighbourIds.forEach(nhbrNodeId =>
        graph.registerEdge({ src: graphNodeId, dst: nhbrNodeId })
      );
    }

    return graph;
  }

  /**
   * Find node closest to @see {position}.
   * - if some node contains it, return that node
   * - can filter considered nodes
   * - can provide fallback nodes e.g. all nodes in a room
   * - can fallback to all nodes
   * - can fallback to closest centroid
   * 
   * https://github.com/donmccurdy/three-pathfinding/blob/ca62716aa26d78ad8641d6cebb393de49dd70e21/src/Pathfinding.js#L78
   * @param {Geom.VectJson} position in local geomorph coordinates 
   * @param {{
   *   filterNodeIds?(nodeId: number): boolean;
   *   getFallbackNodes?(): Graph.FloorGraphNode[];
   *   allNodesFallback?: boolean;
   *   centroidsFallback?: boolean;
   * }} [opts]
   */
  getClosestNode(
    position,
    opts = {},
  ) {
    // Restrict to few nav nodes via precomputed `gridToNodeIds`
    const gridPos = coordToNavNodeGrid(position.x, position.y);
    let closeNodes = this.gm.navZone.gridToNodeIds[gridPos.x]?.[gridPos.y]
      ?.filter(opts.filterNodeIds ?? (_ => true))
      ?.map(nodeId => this.nodesArray[nodeId]
    ) ?? [];

    // Fallback e.g. to all nav nodes in particular room
    if (closeNodes.length === 0 && opts.getFallbackNodes) {
      closeNodes = opts.getFallbackNodes();
    }

    const found = closeNodes.find(
      (node) => Utils.isVectorInPolygon(position, node, this.vectors),
    );

    if (found || !opts.centroidsFallback) {
      return found ?? null;
    }

    if (closeNodes.length === 0 && opts.allNodesFallback) {
      closeNodes = this.nodesArray;
    }

    // Find node in `closeNodes` with closest centroid
    warn(`${this.gm.key}: no navnode contains: ${JSON.stringify(position)}`);
    let closestNode = /** @type {null | Graph.FloorGraphNode} */ (null);
    let closestDistance = Infinity;
    closeNodes.forEach((node) => {
      const distance = Utils.distanceToSquared(node.astar.centroid, position);
      if (distance < closestDistance) {
        closestNode = node;
        closestDistance = distance;
      }
    });
    return closestNode;
  }

  /**
   * Runs @see {getClosestNode} possibly restricting to roomId,
   * returning closest point on triangle if node exists.
   * @param {Geom.VectJson} position
   * @param {number} [roomId]
   * @returns {Geom.ClosestOnOutlineResult | null}
   */
  getClosePoint(position, roomId) {
    const node = this.getClosestNode(
      position,
      typeof roomId === 'number' ? {
        filterNodeIds: (nodeId) => this.nodeToMeta[nodeId].roomId === roomId,
        getFallbackNodes: () => this.strictRoomNodeIds[roomId].map(nodeId => this.nodesArray[nodeId]),
        centroidsFallback: true,
      } : undefined,
    );

    if (node) {
      const triangle = node.vertexIds.map(vertexId => this.vectors[vertexId]);
      const result = geom.getClosestOnOutline(position, triangle);
      // move close point towards centroid, to ensure navigable
      const delta = Vect.from(result.point).sub(node.astar.centroid);
      delta.normalize(Math.max(0, delta.length - 0.1));
      result.point.x = node.astar.centroid.x + delta.x;
      result.point.y = node.astar.centroid.y + delta.y;
      return result;
    } else {
      return null;
    }
  }

  /**
   * @private
   * @param {Graph.FloorGraphNode} a 
   * @param {Graph.FloorGraphNode} b
   */
  getPortalFromTo(a, b) {
    for (let i = 0; i < a.astar.neighbours.length; i++) {
      if (a.astar.neighbours[i] === b.index) {
        return a.portals[i];
      }
    }
  }
 
}
