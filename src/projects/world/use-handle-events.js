import React from "react";
import { assertDefined, testNever } from "../service/generic";
import { decodeDecorInstanceKey } from "../service/geomorph";
import * as npcService from "../service/npc";
import useSession from "../sh/session.store"; // 🤔 avoid dep?
import { ansi } from "../sh/util";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('../world/World').State} api
 */
export default function useHandleEvents(api) {

  const state = useStateRef(/** @type {() => State} */ () => ({

    async handleNpcEvent(e) {
      switch (e.key) {
        case 'changed-speed': {
          const npc = api.npcs.getNpc(e.npcKey);
          if (npc.anim.wayMetas.length) {// Changed speed, so recompute timing:
            window.clearTimeout(npc.anim.wayTimeoutId);
            npc.nextWayTimeout();
          }
          break;
        }
        case 'decor-click':
          mockHandleDecorClick(e, api);
          break;
        case 'disabled':
          api.fov.mapAct('pause');
          api.panZoom.animationAction('pause');
          break;
        case 'enabled':
          api.fov.mapAct('resume');
          if (!api.npcs.isPanZoomControlled()) {
            // only resume when not controlled by e.g. `view` or `track`
            api.panZoom.animationAction('play');
          }
          break;
        case 'fov-changed':
          // console.log(e);
          api.decor.updateLocalDecor({ added: e.added, removed: e.removed, });
          break;
        case 'on-tty-link':
          mockOnTtyLink(e, api);
          break;
        case 'set-player':
          api.npcs.setPlayerKey(e.npcKey);
          break;
        case 'stopped-walking': {
          const player = api.npcs.getPlayer();
          if (player?.isWalking() && e.npcKey !== player.key) {
            // Player may be about to collide with NPC e.npcKey
            const npc = api.npcs.getNpc(e.npcKey);
            const collision = npcService.predictNpcNpcCollision(player, npc);
            if (collision) {
              console.warn(`${npc.key} will collide with ${player.key}`, collision);
              // 🚧 somehow pause setTimeout on World disable
              setTimeout(() => cancelNpcs(player.key, npc.key), collision.seconds * 1000);
            }
          }
          break;
        }
        case 'way-point':
          await state.handleWayEvents(e);
          break;
        case 'decors-added':
        case 'decors-removed':
        case 'npc-clicked':
        case 'npc-internal':
        case 'removed-npc':
        case 'spawned-npc':
        case 'started-walking':
          break;
        default:
          throw testNever(e, { suffix: 'npcsSub' });
      }
    },

    async handlePlayerEvent(e) {
      switch (e.key) {
        case 'spawned-npc':
          // 🚧 Do we always need to reset this?
          api.fov.prev = { gmId: -1, roomId: -1, doorId: -1, openDoorsIds: [] };
          api.npcs.setRoomByNpc(e.npcKey);
          break;
        case 'started-walking':
          // Player could have warped to start of navPath, changing FOV
          const [id] = api.npcs.getNpc(e.npcKey).anim.gmRoomIds;
          if (!id) {// custom navPaths needn't have gmRoomIds
            api.npcs.setRoomByNpc(e.npcKey);
          } else if (api.fov.gmId !== id[0] || api.fov.roomId !== id[1]) {
            api.fov.setRoom(...id, -1);
          }
          break;
        case 'stopped-walking': {
          // Walking NPCs may be about to collide with Player,
          // e.g. before they start a new line segment
          const player = api.npcs.getPlayer();
          player && Object.values(api.npcs.npc).filter(x => x !== player && x.isWalking()).forEach(npc => {
            const collision = npcService.predictNpcNpcCollision(npc, player);
            if (collision) {
              console.warn(`${e.npcKey} will collide with ${npc.key}`, collision);
              // 🚧 somehow pause setTimeout on World disable
              setTimeout(() => cancelNpcs(npc.key, player.key), collision.seconds * 1000);
            }
          });
          break;
        }
        case 'way-point':
          state.handlePlayerWayEvent(e);
          break;
        case 'changed-speed':
        case 'npc-clicked':
        case 'npc-internal':
        case 'removed-npc':
        case 'set-player':
          break;
        default:
          throw testNever(e, { suffix: 'npcsSub' });
      }
    },

    async handleWayEvents(e) {
      // console.warn('handleWayEvents', e.npcKey, e.meta);
      const npc = api.npcs.getNpc(e.npcKey);

      switch (e.meta.key) {
        case 'npcs-collide':
          cancelNpcs(e.npcKey, e.meta.otherNpcKey);
          break;
        case 'vertex':
          if ((e.meta.index + 1) === npc.anim.path.length) {
            break; // We've finished
          }

          // `npc` is walking:
          npc.updateWalkSegBounds(e.meta.index);
          state.predictNpcNpcsCollision(npc, e);
          state.predictNpcDecorCollision(npc, e.meta);
          break;
        case 'at-door': {
          const { gmId, doorId, tryOpen } = e.meta;
          if (!api.doors.open[gmId][doorId]) {// Upcoming door closed
            if (tryOpen && !api.doors.locked[gmId][doorId]) {
              api.doors.toggleDoor(gmId, doorId, { open: true });
            } else { // Stop npc
              await npc.cancel();
            }
          }
          break;
        }
        case 'enter-room': {
          npc.updateRoomWalkBounds(e.meta.index);
          break;
        }
        case 'decor-collide':
        case 'exit-room':
          break;
        default:
          throw testNever(e.meta, { suffix: 'handleWayEvents' });
      }
    },

    handlePlayerWayEvent(e) {
      // console.log('handlePlayerWayEvent', e.meta);
      switch (e.meta.key) {
        case 'exit-room':
          if (e.meta.otherRoomId !== null) {
            api.fov.setRoom(e.meta.gmId, e.meta.otherRoomId, e.meta.doorId);
          } else {// Handle hull doors
            const adjCtxt = api.gmGraph.getAdjacentRoomCtxt(e.meta.gmId, e.meta.hullDoorId);
            adjCtxt && api.fov.setRoom(adjCtxt.adjGmId, adjCtxt.adjRoomId, adjCtxt.adjDoorId);
          }
          break;
        case 'enter-room':
          // Needed in case we exit-room via doorway then immediately re-enter
          api.fov.setRoom(e.meta.gmId, e.meta.enteredRoomId, e.meta.doorId);
          break;
        case 'at-door':
        case 'decor-collide':
        case 'npcs-collide':
        case 'vertex':
          break;
        default:
          throw testNever(e.meta, { suffix: 'handlePlayerWayEvent' });
      }
    },

    predictNpcDecorCollision(npc, meta) {
      // Restrict to decor in room containing line-segment's 1st vertex
      // ℹ️ assume room-traversing segments end on border (?)
      const [gmId, roomId] = npc.anim.gmRoomIds[meta.index];

      const { collide: closeDecor } = api.decor.cacheNpcWalk(npc.key, gmId, roomId);

      for (const decor of closeDecor) {
        const {collisions, startInside} = decor.type === 'circle'
          ? npcService.predictNpcCircleCollision(npc, decor)
          : npcService.predictNpcPolygonCollision(
              npc,
              assertDefined(decor.derivedPoly?.outline),
              assertDefined(decor.derivedBounds),
            )
        ;

        if (collisions.length || startInside) {// 🚧 debug
          console.warn(`${npc.key} collide decor ${decor.type} ${decor.key}`, startInside, collisions);
        }
        
        collisions.forEach((collision, collisionIndex) => {
          const length = meta.length + collision.distA;
          const insertIndex = npc.anim.wayMetas.findIndex(x => x.length >= length);
          npc.anim.wayMetas.splice(insertIndex, 0, {
            key: 'decor-collide',
            index: meta.index,
            decorKey: decor.key,
            type: startInside
              ? collisionIndex === 0 ? 'exit' : 'enter'
              : collisionIndex === 0 ? 'enter' : 'exit',
            gmId: meta.gmId,
            length,
          });
        });
        startInside && (meta.index === 0) && npc.anim.wayMetas.unshift({
          key: 'decor-collide',
          index: meta.index,
          decorKey: decor.key,
          type: 'start-inside', // start walk inside
          gmId: meta.gmId,
          length: meta.length,
        });
      }
    },

    predictNpcNpcsCollision(npc, e) {
      const otherNpcs = Object.values(api.npcs.npc).filter(x => x !== npc);

      for (const other of otherNpcs) {
        const collision = npcService.predictNpcNpcCollision(npc, other);
        if (collision) {// Add wayMeta cancelling motion
          console.warn(`${npc.key} will collide with ${other.key}`, collision);
          const length = e.meta.length + collision.distA;
          const insertIndex = npc.anim.wayMetas.findIndex(x => x.length >= length);
          npc.anim.wayMetas.splice(insertIndex, 0, {
            key: 'npcs-collide',
            index: e.meta.index,
            otherNpcKey: other.key,
            gmId: e.meta.gmId,
            length,
          });
        }
      }
    },

  }), {
    deps: [api.gmGraph],
  });

  //#region handle door events, npc events
  React.useEffect(() => {

    if (!(api.gmGraph.ready && api.doors.ready && api.npcs.ready)) {
      return;
    }

    // Update doors and lights on change
    const doorsSub = api.doors.events.subscribe((e) => {
      switch (e.key) {
        case 'closed-door': {
          const { gmId, doorId } = e;
          api.geomorphs.onCloseDoor(gmId, doorId);
          api.fov.updateClipPath();
          break;
        }
        case 'opened-door': {
          const { gmId, doorId } = e;
          api.geomorphs.onOpenDoor(gmId, doorId);
          api.fov.updateClipPath();
          break;
        }
      }
    });

    // React to NPC events
    const npcsSub = api.npcs.events.subscribe((e) => {
      if ('npcKey' in e && (e.npcKey === api.npcs.playerKey)) {
        state.handlePlayerEvent(e);
      }
      state.handleNpcEvent(e);
    });

    // React to CssPanZoom events
    const panZoomSub = api.panZoom.events.subscribe((e) => {
      if (e.key === 'pointerup' && e.meta.npc === true && typeof e.meta.npcKey === 'string') {
        const { npcKey } = e.meta;;
        api.npcs.events.next({
          key: 'npc-clicked',
          npcKey,
          position: e.point,
          isPlayer: api.npcs.playerKey === npcKey,
        });
      }
    });

    return () => {
      doorsSub.unsubscribe();
      npcsSub.unsubscribe();
      panZoomSub.unsubscribe();
    };

  }, [api.gmGraph.ready, api.doors.ready, api.npcs.ready]);
  //#endregion

  /** @param {...string} npcKeys */
  async function cancelNpcs(...npcKeys) {
    await Promise.all(npcKeys.map(key => api.npcs.getNpc(key).cancel()));
  }

}

/**
 * @typedef State @type {object}
 * @property {(npc: NPC.NPC, meta: NPC.NpcWayMetaVertex) => void} predictNpcDecorCollision
 * @property {(npc: NPC.NPC, e: NPC.NPCsWayEvent) => void} predictNpcNpcsCollision
 * @property {(e: NPC.NPCsEvent) => Promise<void>} handleNpcEvent
 * Handle NPC event (always runs)
 * @property {(e: NPC.NPCsEventWithNpcKey) => Promise<void>} handlePlayerEvent
 * Handle Player NPC events (only runs when e.npcKey is playerKey)
 * @property {(e: NPC.NPCsWayEvent) => void} handlePlayerWayEvent
 * @property {(e: NPC.NPCsWayEvent) => Promise<void>} handleWayEvents
 */

/**
 * 🚧 mock
 * @param  {NPC.NPCsEvent & { key: 'decor-click' }} event
 * @param  {import('./World').State} api
 */
function mockHandleDecorClick(event, api) {
  const decor = event.decor;
  if (decor.type === 'point') {
    const worldSessions = Object.values(api.npcs.session).filter(({ receiveMsgs }) => receiveMsgs === true);
    if (decor.meta.label) {
      /** Assume `[...tags, label, ...labelWords]` */
      const label = `${decor.meta.label}`;
      const { gmId, roomId } = decodeDecorInstanceKey(decor.key);
      const gm = api.gmGraph.gms[gmId];
      const numDoors = gm.roomGraph.getAdjacentDoors(roomId).length;
      // Square brackets induces a link via `linkProviderDef`
      const line = `ℹ️  [${ansi.Blue}${label}${ansi.Reset}] with ${numDoors} door${numDoors > 1 ? 's' : ''}`;
      
      worldSessions.map(({ key: sessionKey }) => useSession.api.writeMsgCleanly(sessionKey, line, { ttyLinkCtxts: [{// Manually record where the link was
        lineText: line, 
        linkText: label,
        // linkStartIndex: visibleUnicodeLength('ℹ️  ['),
        linkStartIndex: ('ℹ️  [').length,
        async callback() {
          // ℹ️ could have side effect e.g. panzoom
          const point = gm.matrix.transformPoint(gm.rooms[roomId].center);
          await api.npcs.panZoomTo({ zoom: 2, ms: 2000, point });
          // ℹ️ return value is important
        },
      }] }));
    }
    api.npcs.config.logTags && worldSessions.map(({ key: sessionKey }) => useSession.api.writeMsgCleanly(
      sessionKey,
      `${ansi.White}ℹ️  ${JSON.stringify(decor.meta??{})}${ansi.Reset}`,
    ));
  }

}

/**
 * 🚧 mock
 * @param {NPC.NPCsEvent & { key: 'on-tty-link' }} event
 * @param  {import('./World').State} api
 */
function mockOnTtyLink(event, api) {
  const ttyCtxt = event.ttyCtxt;
  if (ttyCtxt.key === 'room') {
    const gm = api.gmGraph.gms[ttyCtxt.gmId];
    const point = gm.matrix.transformPoint(gm.rooms[ttyCtxt.roomId].center);
    api.npcs.panZoomTo({ zoom: 2, ms: 2000, point });
  }
}