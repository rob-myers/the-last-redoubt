import { Poly } from "../geom";
import { BaseGraph } from "./graph";
import { error } from "../service/log";

/**
 * @extends {BaseGraph<Graph.RoomGraphNode, Graph.RoomGraphEdgeOpts>}
 */
export class roomGraphClass extends BaseGraph {

  /**
   * @param {Graph.RoomGraphJson} json 
   */  
  static from(json) {
    return (new roomGraphClass).plainFrom(json);
  }

  /**
   * Given nodes, find all adjacent doors.
   * @param {...number} roomIds
   */
  getAdjacentDoors(...roomIds) {
    const doors = /** @type {Set<Graph.RoomGraphNodeDoor>} */ (new Set);
    roomIds.forEach(roomId => this.getSuccs(this.nodesArray[roomId]).forEach(other =>
      other.type === 'door' && doors.add(other))
    );
    return Array.from(doors);
  }
  /**
   * Given parent `gm` and some nodes, find adjacent _hull door ids_ (if any).
   * @param {Geomorph.GeomorphDataInstance} gm
   * @param {...number} roomIds
   */
  getAdjacentHullDoorIds(gm, ...roomIds) {
    return this.getAdjacentDoors(...roomIds)
      .map(node => /** @type {const} */ ([node, gm.doors[node.doorId]]))
      .flatMap(([{ doorId }, door]) => door.roomIds.some(x => x === null)
        ? { doorId, hullDoorId: gm.hullDoors.indexOf(door) } : []
      );
  }

  /**
   * Given nodes, find all adjacent windows.
   * @param {...number} roomIds
   */
  getAdjacentWindows(...roomIds) {
    const windows = /** @type {Set<Graph.RoomGraphNodeWindow>} */ (new Set);
    roomIds.forEach(roomId => this.getSuccs(this.nodesArray[roomId]).forEach(other =>
      other.type === 'window' && windows.add(other))
    );
    return Array.from(windows);
  }

  /**
   * Given door/window nodes find all adjacent rooms.
   * @param {...Graph.RoomGraphNodeConnector} nodes
   */
  getAdjacentRooms(...nodes) {
    const rooms = /** @type {Set<Graph.RoomGraphNodeRoom>} */ (new Set);
    nodes.forEach(node => this.getSuccs(node)
      .forEach(other => other.type === 'room' && rooms.add(other))
    );
    return Array.from(rooms);
  }

  /** @param {number} doorId */
  getDoorNode(doorId) {
    return /** @type {Graph.RoomGraphNodeDoor} */ (this.getNodeById(`door-${doorId}`));
  }

  /**
   * Given room id, find all rooms reachable via a single window or open door.
   * @param {number} roomId
   * @param {number[]} openDoorIds
   */
   getOpenRoomIds(roomId, openDoorIds) {
    return this.getSuccs(this.nodesArray[roomId]).flatMap((adjNode) => {
      if (
        adjNode.type === 'door' && openDoorIds.includes(adjNode.doorId)
        || adjNode.type === 'window'
      ) {
        return (this.getOtherRoom(adjNode, roomId)?.roomId)??[];
      } else {
        return [];
      }
    });
  }

  /**
   * 
   * @param {Graph.RoomGraphNodeConnector} doorOrWindowNode 
   * @param {number} roomId 
   */
  getOtherRoom(doorOrWindowNode, roomId) {
    return /** @type {null | Graph.RoomGraphNodeRoom} x */ (
      this.getSuccs(doorOrWindowNode).find(
        x => x.type === 'room' && x.roomId !== roomId
      )??null
    );
  }

  /** @param {number} roomId */
  getRoomNode(roomId) {
    return /** @type {Graph.RoomGraphNodeRoom} */ (this.getNodeById(`room-${roomId}`));
  }

  /** @param {number} windowIndex */
  getWindowNode(windowIndex) {
    return /** @type {Graph.RoomGraphNodeWindow} */ (this.getNodeById(`window-${windowIndex}`));
  }

  /**
  * @param {Geom.Poly[]} rooms 
  * @param {Geomorph.ParsedLayout['doors']} doors 
  * @param {Geomorph.ParsedLayout['windows']} windows 
  * @returns {Graph.RoomGraphJson}
  */
  static json(rooms, doors, windows) {

    /**
     * For each door, the respective adjacent room ids.
     * Each array will be aligned with the respective door node's successors.
     */
    const doorsRoomIds = doors.map(door => rooms.flatMap((room, i) => Poly.union([room, door.poly]).length === 1 ? i : []));
    const windowsRoomIds = windows.map(window => rooms.flatMap((room, i) => Poly.union([room, window.poly]).length === 1 ? i : []));

    /** @type {Graph.RoomGraphNode[]} */
    const roomGraphNodes = [
      // Observe that `roomId` is the respective node id,
      // because we start the nodes with the room nodes
      ...rooms.map((_, roomId) => ({
        id: `room-${roomId}`, type: /** @type {const} */ ('room'), roomId,
      })),
      ...doors.map((_, doorId) => {
        /** @type {Graph.RoomGraphNodeDoor} */
        const doorNode = { id: `door-${doorId}`, type: /** @type {const} */ ('door'), doorId };
        return doorNode;
      }),
      ...windows.map((_, windowId) => {
        /** @type {Graph.RoomGraphNodeWindow} */
        const windowNode = { id: `window-${windowId}`, type: /** @type {const} */ ('window'), windowId };
        return windowNode;
      }),
    ];

    /** @type {Graph.RoomGraphEdgeOpts[]} */
    const roomGraphEdges = [
      ...doors.flatMap((_door, doorIndex) => {
        const roomIds = doorsRoomIds[doorIndex];
        if ([1, 2].includes(roomIds.length)) {// Hull door has 1, standard has 2
          return roomIds.flatMap(roomId => [// undirected, so 2 directed edges
            { src: `room-${roomId}`, dst: `door-${doorIndex}` },
            { dst: `room-${roomId}`, src: `door-${doorIndex}` },
          ]);
        } else {
          error(`door ${doorIndex}: unexpected adjacent rooms: ${JSON.stringify(roomIds)}`)
          return [];
        }
      }),
      ...windows.flatMap((_window, windowIndex) => {
        const roomIds = windowsRoomIds[windowIndex];
        if ([1,2].includes(roomIds.length)) {// Hull window has 1, standard has 2
          return roomIds.flatMap(roomId => [// undirected, so 2 directed edges
            { src: `room-${roomId}`, dst: `window-${windowIndex}` },
            { dst: `room-${roomId}`, src: `window-${windowIndex}` },
          ]);
        } else {
          error(`window ${windowIndex}: unexpected adjacent rooms: ${JSON.stringify(roomIds)}`)
          return [];
        }
      }),
    ];

   /** @type {Graph.RoomGraphJson} */
   const roomGraphJson = {
     nodes: roomGraphNodes,
     edges: roomGraphEdges,
   };

   return roomGraphJson;
  }

}
