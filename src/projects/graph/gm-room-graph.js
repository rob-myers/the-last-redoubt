import { mapValues } from "../service/generic";
import { getGmDoorKey, getGmRoomKey, isSameGmRoom } from "../service/geomorph";
import { BaseGraph } from "./graph";

/**
 * @extends {BaseGraph<Graph.GmRoomGraphNode, Graph.GmRoomGraphEdgeOpts>}
 */
export class gmRoomGraphClass extends BaseGraph {

  api = /** @type {{ doors: Omit<import('../world/World').State['doors'], 'rootEl'>; isReady(): boolean; }} */  ({
    isReady() { return false; },
  });

  /**
   * 🤔 optional GmDoorId.parallelDoorIds?
   * e.g. relDoor[gmId][doorId]?.doorIds
   * @type {{ [doorId: number]: { doors: Geomorph.GmDoorIdWithMeta[]; windows: Graph.GmWindowId[]; }}[]}
   */
  relDoor = [];

  /**
   * `gmNodeOffset[gmId]` is index of 1st node originally from `gmId`
   * @type {number[]}
   */
  gmNodeOffset = [];

  /**
   * Get `GmDoorId`s of doors connecting two gmRoomIds, if any.
   * They are relative to srcRm (adj hull doors appear as other).
   * @param {Geomorph.GmRoomId} srcRm 
   * @param {Geomorph.GmRoomId} dstRm 
   * @returns {Geomorph.GmDoorId[] | null}
   */
  getAdjGmDoorIds(srcRm, dstRm, requireOpen = false) {
    const src = this.getNode(srcRm.gmId, srcRm.roomId);
    const dst = this.getNode(dstRm.gmId, dstRm.roomId);
    const doors = this.succ.get(src)?.get(dst)?.doors;
    if (!doors) {
      return null; // Not adjacent
    }
    const doorApi = this.api.doors;
    return (doors ?? []).filter(p => !requireOpen || doorApi.isOpen(p.gmId, p.doorId));
  }

  /**
   * @param {number} gmId 
   * @param {number} roomId 
   */
  getNode(gmId, roomId) {
    return this.nodesArray[this.gmNodeOffset[gmId] + roomId];
  }

  /**
   * Assume `srcRm`, `dstRm` not equal and non-adjacent.
   * 
   * We'll detect the following situations:
   * - `srcRm` has adjacent room `rm1` via door `d1`
   * - `dstRm` has adjacent room `rm1` via door `d2`
   * - `d1` and `d2` are related (relate-connectors)
   * 
   * `rm1`, `rm2` may be equal (often the case) or adjacent (long relation),
   * or even further apart (longer relation).
   *
   * @param {Geomorph.GmRoomId} srcRm 
   * @param {Geomorph.GmRoomId} dstRm not srcRm, nor adjacent to it
   * @returns {{ src: Geomorph.GmDoorId; depDoors?: Geomorph.GmDoorId[]; dst: Geomorph.GmDoorId; }[]}
   */
  getRelDoorIds(srcRm, dstRm, requireOpen = false) {
    const output = /** @type {ReturnType<typeof this.getRelDoorIds>} */ ([]);
    const src = this.getNode(srcRm.gmId, srcRm.roomId);
    const dst = this.getNode(dstRm.gmId, dstRm.roomId);
    
    const srcDoorKeys = this.getEdgesFrom(src).flatMap(e => e.doors.map(x => x.key));
    const dstDoorKeys = this.getEdgesFrom(dst).flatMap(e => e.doors.map(x => x.key));

    const checkOpen = /** @param {number} gmId @param {number} doorId */
      (gmId, doorId) => !requireOpen || this.api.doors.isOpen(gmId, doorId)
    ;

    for (const [_rm1, { doors: srcDoors }] of this.succ.get(src)?.entries() ?? []) {
      srcDoors.forEach(srcDoor => {
        (this.relDoor[srcDoor.gmId]?.[srcDoor.doorId]?.doors ?? []).forEach(relGmDoor => {
          const found = dstDoorKeys.includes(relGmDoor.key);
          if (found
            && checkOpen(srcDoor.gmId, srcDoor.doorId)
            && (relGmDoor.depDoors ?? []).every((depDoor) =>
              checkOpen(depDoor.gmId, depDoor.doorId)
              // avoid "jumping over" srcRm or dstRm
              && !srcDoorKeys.includes(depDoor.key)
              && !dstDoorKeys.includes(depDoor.key)
            )
            && checkOpen(relGmDoor.gmId, relGmDoor.doorId)
          ) {
            output.push({
              src: srcDoor,
              depDoors: relGmDoor.depDoors,
              dst: relGmDoor,
            });
          }
        });
      });
    }

    return output;
  }

  /**
   * @param {Geomorph.GmRoomId} gmRoomId 
   * @param {Geomorph.GmRoomId} other 
   * @returns {{ key: 'same-room' } | { key: 'adj-room'; gmDoorIds: Geomorph.GmDoorId[]; } | { key: 'rel-room'; relation: ReturnType<Graph.GmRoomGraph['getRelDoorIds']>; } | null}
   */
  getVantages(gmRoomId, other, requireOpen = true) {
    if (isSameGmRoom(gmRoomId, other)) {
      return { key: 'same-room' };
    }
    const gmDoorIds = this.getAdjGmDoorIds(gmRoomId, other, requireOpen);
    if (gmDoorIds) {
      if (gmDoorIds.length) return { key: 'adj-room', gmDoorIds };
      else return null; // Adjacent but no door open
    }
    const relation = this.getRelDoorIds(gmRoomId, other, requireOpen);
    if (relation.length) {
      return { key: 'rel-room', relation };
    }
    return null;
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
      agg[gmId + 1] = agg[gmId] + gm.rooms.length;
      return agg;
    }, /** @type {typeof graph.gmNodeOffset} */ ([0]));

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
                  { key: getGmDoorKey(gmId, doorId), gmId, doorId, other: { gmId: ctxt.adjGmId, doorId: ctxt.adjDoorId } }
                );
              } // ctxt `null` for unconnected hull doors
            } else {
              const otherRoomId = /** @type {number} */ (gm.getOtherRoomId(doorId, roomId));
              (agg[JSON.stringify(gmRoomId = { gmId, roomId: otherRoomId })] ??= [[], []])[0].push(
                { key: getGmDoorKey(gmId, doorId), gmId, doorId },
              );
            }
            return agg;
          },
          /** @type {{ [gmRoomId: string]: [Geomorph.GmDoorId[], Graph.GmWindowId[]] }} */ ({}),
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
      const depIdToDepDoor = /** @param {number} id */ id => ({ key: getGmDoorKey(gmId, id), gmId, doorId: id });
      graph.relDoor[gmId] = mapValues(gm.relDoorId, ({ doors, windows, metas }, srcDoorIdStr) => {
        return {
          doors: doors.flatMap(dstDoorId => {
            if (gm.isHullDoor(dstDoorId)) {
              const ctxt = gmGraph.getAdjacentRoomCtxt(gmId, dstDoorId);
              if (ctxt) {
                const srcDoorId = Number(srcDoorIdStr);
                const converseMeta = gm.relDoorId[dstDoorId].metas[srcDoorId];
                // Store converse relation from identified hull door to srcDoorId (for later):
                (extras[ctxt.adjGmId][ctxt.adjDoorId] ??= { doors: [], windows: [] }).doors.push({
                  key: getGmDoorKey(gmId, srcDoorId),
                  gmId,
                  doorId: srcDoorId,
                  behind: converseMeta.behind,
                  depDoors: converseMeta.depIds?.map(depIdToDepDoor),
                  // ℹ️ no `other` because cannot relate hull door to another hull door
                });
                return [
                  {
                    key: getGmDoorKey(gmId, dstDoorId), gmId, doorId: dstDoorId,
                    other: { gmId: ctxt.adjGmId, doorId: ctxt.adjDoorId },
                    behind: metas[dstDoorId].behind,
                    depDoors: metas[dstDoorId].depIds?.map(depIdToDepDoor),
                  },
                  // Also relate to identified hull door:
                  // 🤔 behind should be [true, false] | [false, true]
                  {
                    key: getGmDoorKey(gmId, dstDoorId), gmId: ctxt.adjGmId, doorId: ctxt.adjDoorId,
                    other: { gmId, doorId: dstDoorId },
                    behind: [false, false],
                    depDoors: metas[dstDoorId].depIds?.map(depIdToDepDoor),
                  },
                ];
              }
            }
            return {
              key: getGmDoorKey(gmId, dstDoorId), gmId, doorId: dstDoorId,
              behind: metas[dstDoorId].behind,
              depDoors: metas[dstDoorId].depIds?.map(depIdToDepDoor),
            };
          }),
          windows: windows.map(windowId => ({ gmId, windowId })),
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
