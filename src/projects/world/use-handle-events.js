import React from "react";
import { filter } from "rxjs/operators";
import { testNever } from "../service/generic";
import { predictNpcNpcCollision } from "../service/npc";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('../world/World').State} api
 */
export default function useHandleEvents(api) {

  /**
   * @param {string} npcKey
   * @param {string} otherNpcKey
   */
  function handleNpcCollision(npcKey, otherNpcKey) {
    const npc = api.npcs.getNpc(npcKey);
    const other = api.npcs.getNpc(otherNpcKey);
    npc.cancel();
    other.cancel();
  }

  const state = useStateRef(/** @type {() => State} */ () => ({
    async handleCollisions(e) {
      switch (e.meta.key) {
        case 'pre-collide':
          handleNpcCollision(e.npcKey, e.meta.otherNpcKey);
          break;
        case 'start-seg': {
          /**
           * 1. We know `npc` is walking.
           * 2. 🚧 Either `npc` or `other` should be the Player.
           */
          const npc = api.npcs.getNpc(e.npcKey);
          const others = Object.values(api.npcs.npc).filter(x => x !== npc);

          for (const other of others) {
            const collision = predictNpcNpcCollision(npc, other);
            // console.log('CHECK COLLIDED', npc.key, other.key, !!collision);
            if (collision) {
              // Add wayMeta cancelling motion
              console.warn(`${npc.key} will collide with ${other.key}`, collision);
              const length = e.meta.length + collision.distA;
              const insertIndex = npc.anim.wayMetas.findIndex(x => x.length >= length);
              npc.anim.wayMetas.splice(insertIndex, 0, {
                key: 'pre-collide',
                index: e.meta.index,
                otherNpcKey: other.key,
                gmId: e.meta.gmId,
                length,
              });
            }
          }
          break;
        }
        case 'pre-exit-room':
        case 'pre-near-door': {
          // If upcoming door is closed, stop npc
          if (!api.doors.open[e.meta.gmId][e.meta.doorId]) {
            const npc = api.npcs.getNpc(e.npcKey);
            await npc.cancel();
          }
          break;
        }
      }
    },

    handlePlayerWayEvent(e) {
      // console.log('player way event', e);
      switch (e.meta.key) {
        case 'exit-room':
          // Player left a room
          if (e.meta.otherRoomId !== null) {
            api.fov.setRoom(e.meta.gmId, e.meta.otherRoomId, e.meta.doorId);
          } else {// Handle hull doors
            const adjCtxt = api.gmGraph.getAdjacentRoomCtxt(e.meta.gmId, e.meta.hullDoorId);
            adjCtxt && api.fov.setRoom(adjCtxt.adjGmId, adjCtxt.adjRoomId, adjCtxt.adjDoorId);
          }
          api.updateAll();
          break;
        case 'enter-room':
          if (api.fov.setRoom(e.meta.gmId, e.meta.enteredRoomId, e.meta.doorId)) {
            api.updateAll();
          }
          break;
        case 'pre-exit-room':
        case 'pre-near-door':
        case 'start-seg':
        case 'pre-collide':
          break;
        default:
          throw testNever(e.meta);
      }
    },
  }), {
    deps: [api.gmGraph],
  });

  React.useEffect(() => {
    if (api.gmGraph.gms.length && api.doors.ready && api.npcs.ready) {
      api.updateAll();

      // Update doors and lights on change
      const doorsSub = api.doors.events
        .pipe(filter(x => x.key === 'closed-door' || x.key === 'opened-door'))
        .subscribe(() => api.updateAll());

      // React to NPC events
      const npcsSub = api.npcs.events.subscribe((e) => {
        switch (e.key) {
          case 'decor':
            api.npcs.setDecor(e.meta.key, e.meta);
            break;
          case 'set-player':
            api.npcs.playerKey = e.npcKey || null;
            e.npcKey && api.npcs.setRoomByNpc(e.npcKey);
            break;
          case 'spawned-npc':
            // This event also happens on hot-reload NPC.jsx
            if (api.npcs.playerKey === e.npcKey) {
              api.fov.prev = { gmId: -1, roomId: -1, doorId: -1, openDoorsIds: [] };
              api.npcs.setRoomByNpc(e.npcKey);
            }
            /**
             * TODO collision test against player, e.g.
             * in case they've already started final segment
             */
            break;
          case 'started-walking':
            break;
          case 'stopped-walking':
            const playerNpc = api.npcs.getPlayer();
            if (playerNpc && e.npcKey === playerNpc.key) {
              // Walking non-players may be about to collide with Player,
              // before they start a new line segment, so we must test collision now
              Object.values(api.npcs.npc).filter(x => x !== playerNpc && x.isWalking()).forEach(npc => {
                const collision = predictNpcNpcCollision(npc, playerNpc);
                if (collision) {
                  setTimeout(() => handleNpcCollision(npc.key, playerNpc.key), collision.seconds * 1000);
                }
              });
            }
            break;
          case 'unmounted-npc':
            // This event also happens on hot-reload NPC.jsx
            delete api.npcs.npc[e.npcKey];
            break;
          case 'way-point':
            if (e.npcKey === api.npcs.playerKey) {
              state.handlePlayerWayEvent(e);
            }
            state.handleCollisions(e);
            break;
          default:
            throw testNever(e);
        }
      });

      return () => {
        doorsSub.unsubscribe();
        npcsSub.unsubscribe();
      };
    }
  }, [api.gmGraph.gms, api.doors.ready, api.npcs.ready]);

}

/**
 * @typedef State @type {object}
 * @property {(e: NPC.NPCsWayEvent) => Promise<void>} handleCollisions
 * @property {(e: NPC.NPCsWayEvent) => void} handlePlayerWayEvent
 */
