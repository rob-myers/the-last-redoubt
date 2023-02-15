import React from "react";
import { testNever, visibleUnicodeLength } from "../service/generic";
import { decodeUiPointDecorKey, } from "../service/geomorph";
import * as npcService from "../service/npc";
import { ansiColor } from "../sh/util";
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

    async handleWayEvents(e) {
      const npc = api.npcs.getNpc(e.npcKey);

      switch (e.meta.key) {
        case 'pre-collide':
          handleNpcCollision(e.npcKey, e.meta.otherNpcKey);
          break;
        case 'start-seg': {
          // We know `npc` is walking
          npc.updateWalkSegBounds(e.meta.index);
          // 🚧 Either `npc` or `other` should be the Player
          const others = Object.values(api.npcs.npc).filter(x => x !== npc);

          for (const other of others) {
            const collision = npcService.predictNpcNpcCollision(npc, other);
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
            await npc.cancel();
          }
          break;
        }
      }
    },

    handlePlayerWayEvent(e) {
      // console.log('player way event', e.meta);
      switch (e.meta.key) {
        case 'exit-room': {
          // FOV
          if (e.meta.otherRoomId !== null) {
            api.fov.setRoom(e.meta.gmId, e.meta.otherRoomId, e.meta.doorId);
          } else {// Handle hull doors
            const adjCtxt = api.gmGraph.getAdjacentRoomCtxt(e.meta.gmId, e.meta.hullDoorId);
            adjCtxt && api.fov.setRoom(adjCtxt.adjGmId, adjCtxt.adjRoomId, adjCtxt.adjDoorId);
          }

          // api.updateAll();
          break;
        }
        case 'enter-room': {
          // Needed in case we exit-room via doorway then immediately re-enter
          api.fov.setRoom(e.meta.gmId, e.meta.enteredRoomId, e.meta.doorId);
          // api.updateAll();
          break;
        }
        case 'pre-exit-room':
        case 'pre-near-door':
        case 'start-seg':
        case 'pre-collide':
          break;
        default:
          throw testNever(e.meta, { suffix: 'handlePlayerWayEvent' });
      }
    },

  }), {
    deps: [api.gmGraph],
  });

  //#region handle door/npc events
  React.useEffect(() => {

    if (!(api.gmGraph.gms.length && api.doors.ready && api.npcs.ready)) {
      return;
    }

    // Update doors and lights on change
    // 🚧 perhaps doors.update() fov.update()
    const doorsSub = api.doors.events.subscribe((e) => {
      switch (e.key) {
        case 'closed-door': {
          const { gmId, doorId } = e;
          api.geomorphs.onCloseDoor(gmId, doorId);
          api.fov.updateClipPath();
          // api.updateAll();
          break;
        }
        case 'opened-door': {
          const { gmId, doorId } = e;
          api.geomorphs.onOpenDoor(gmId, doorId);
          api.fov.updateClipPath();
          // api.updateAll();
          break;
        }
      }
    });

    // React to NPC events
    const npcsSub = api.npcs.events.subscribe((e) => {
      switch (e.key) {
        case 'decors-added':
        case 'decors-removed':
          break;
        case 'decor-click':
          demoHandleDecorClick(e, api);
          break;
        case 'disabled':
        case 'enabled':
          break;
        case 'fov-changed':
          // console.log(e);
          api.npcs.updateLocalDecor({ added: e.added, removed: e.removed, });
          break;
        case 'on-tty-link':
          demoOnTtyLink(e, api);
          break;
        case 'set-player':
          api.npcs.playerKey = e.npcKey || null;
          if (e.npcKey) {
            api.npcs.setRoomByNpc(e.npcKey);
          }
          
          break;
        case 'spawned-npc':
          // This event also happens on hot-reload NPC.jsx
          if (api.npcs.playerKey === e.npcKey) {
            api.fov.prev = { gmId: -1, roomId: -1, doorId: -1, openDoorsIds: [] };
            api.npcs.setRoomByNpc(e.npcKey);
          }
          /**
           * 🚧 collision test against player, e.g.
           * in case they've already started final segment
           */
          break;
        case 'started-walking':
          break;
        case 'stopped-walking': {
          const playerNpc = api.npcs.getPlayer();
          if (!playerNpc) {
            /**
             * Only handle stopped NPC when a Player exists.
             * NPC vs NPC motion should be handled separately.
             */
            break;
          }

          if (e.npcKey === playerNpc.key) {
            // Walking NPCs may be about to collide with Player,
            // e.g. before they start a new line segment
            Object.values(api.npcs.npc).filter(x => x !== playerNpc && x.isWalking()).forEach(npc => {
              const collision = npcService.predictNpcNpcCollision(npc, playerNpc);
              if (collision) {
                setTimeout(() => handleNpcCollision(npc.key, playerNpc.key), collision.seconds * 1000);
              }
            });
          } else if (playerNpc.isWalking()) {
            // Player may be about to collide with NPC
            const npc = api.npcs.getNpc(e.npcKey);
            const collision = npcService.predictNpcNpcCollision(playerNpc, npc);
            if (collision) {
              setTimeout(() => handleNpcCollision(playerNpc.key, npc.key), collision.seconds * 1000);
            }
          }
          break;
        }
        case 'unlit-geomorph-loaded':
          api.geomorphs.initGmLightRects(e.gmId);
          break;
        case 'unmounted-npc':
          // This event also happens on hot-reload NPC.jsx
          delete api.npcs.npc[e.npcKey];
          break;
        case 'way-point':
          if (e.npcKey === api.npcs.playerKey) {
            state.handlePlayerWayEvent(e);
          }
          state.handleWayEvents(e);
          break;
        case 'world-ready':
          // 🚧 useful?
          break;
        default:
          throw testNever(e, { suffix: 'npcsSub' });
      }
    });

    api.fov.updateClipPath();
    api.update();

    return () => {
      doorsSub.unsubscribe();
      npcsSub.unsubscribe();
    };

  }, [api.gmGraph.gms, api.doors.ready, api.npcs.ready]);
  //#endregion

}

/**
 * @typedef State @type {object}
 * @property {(e: NPC.NPCsWayEvent) => Promise<void>} handleWayEvents
 * @property {(e: NPC.NPCsWayEvent) => void} handlePlayerWayEvent
 */


/**
 * ℹ️ Demo: should probably be replaced by shell function(s)
 * @param  {NPC.NPCsEvent & { key: 'decor-click' }} event
 * @param  {import('./World').State} api
 */
function demoHandleDecorClick(event, api) {
  const decor = event.decor;
  if (decor.type === 'point') {
    if (decor.tags?.includes('label')) {
      /** Assume `[...tags, label, ...labelWords]` */
      const label = decor.tags.slice(decor.tags.findIndex(tag => tag === 'label') + 1).join(' ');
      const { decorId: _, gmId, roomId } = decodeUiPointDecorKey(decor.key);
      const gm = api.gmGraph.gms[gmId];
      const numDoors = gm.roomGraph.getAdjacentDoors(roomId).length;
      // Square brackets induces a link via `linkProviderDef`
      const line = `ℹ️  [${ansiColor.Blue}${label}${ansiColor.Reset}] with ${numDoors} door${numDoors > 1 ? 's' : ''}`;
      api.npcs.writeToTtys(line, [{// Manually record where the link was
        lineText: line, 
        linkText: label,
        linkStartIndex: visibleUnicodeLength('ℹ️  ['),
        key: 'room', gmId, roomId,
      }]
    );
    } else {
      api.npcs.writeToTtys(`ℹ️  ${ansiColor.White}tags: ${JSON.stringify(decor.tags??[])}${ansiColor.Reset}`);
    }
  }

}

/**
 * @param {NPC.NPCsEvent & { key: 'on-tty-link' }} event
 * @param  {import('./World').State} api
 */
function demoOnTtyLink(event, api) {
  const ttyCtxt = event.ttyCtxt;
  if (ttyCtxt.key === 'room') {
    const gm = api.gmGraph.gms[ttyCtxt.gmId];
    const point = gm.matrix.transformPoint(gm.point[ttyCtxt.roomId].default.clone());
    api.npcs.panZoomTo({ zoom: 2, ms: 2000, point });
  }
}