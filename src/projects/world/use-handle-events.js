import React from "react";
import { assertDefined, testNever, visibleUnicodeLength } from "../service/generic";
import { decodeDecorInstanceKey, } from "../service/geomorph";
import * as npcService from "../service/npc";
import useSession from "../sh/session.store"; // 🤔 avoid dep?
import { ansiColor } from "../sh/util";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('../world/World').State} api
 */
export default function useHandleEvents(api) {

  const state = useStateRef(/** @type {() => State} */ () => ({

    async handleWayEvents(e) {
      // console.warn('handleWayEvents', e.npcKey, e.meta);
      const npc = api.npcs.getNpc(e.npcKey);

      switch (e.meta.key) {
        case 'pre-npcs-collide':
          cancelNpcs(e.npcKey, e.meta.otherNpcKey);
          break;
        case 'vertex':
          if (e.meta.final) break;
          // We know `npc` is walking
          npc.updateWalkSegBounds(e.meta.index);
          state.predictNpcNpcsCollision(npc, e);
          state.predictNpcDecorCollision(npc, e);
          break;
        case 'pre-near-door':
          // If upcoming door is closed, stop npc
          if (!api.doors.open[e.meta.gmId][e.meta.doorId]) {
            await npc.cancel();
          }
          break;
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
        case 'decor-collide':
        case 'pre-npcs-collide':
        case 'pre-near-door':
        case 'vertex':
          break;
        default:
          throw testNever(e.meta, { suffix: 'handlePlayerWayEvent' });
      }
    },

    predictNpcDecorCollision(npc, e) {
      // Restrict to decor in line segment's rooms (1 or 2 rooms)
      const gmRoomKeys = npc.anim.gmRoomKeys.slice(e.meta.index, (e.meta.index + 1) + 1);
      gmRoomKeys.length === 2 && gmRoomKeys[0] === gmRoomKeys[1] && gmRoomKeys.pop();
      const closeDecor = gmRoomKeys.flatMap((gmRoomKey) => 
        api.decor.getDecorAtKey(gmRoomKey).filter(
          /** @returns {decor is NPC.DecorCircle | NPC.DecorRect} */
          (decor) => decor.type === 'circle' || decor.type === 'rect'
        )
      ,);

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
          const length = e.meta.length + collision.distA;
          const insertIndex = npc.anim.wayMetas.findIndex(x => x.length >= length);
          npc.anim.wayMetas.splice(insertIndex, 0, {
            key: 'decor-collide',
            index: e.meta.index,
            decorKey: decor.key,
            type: startInside
              ? collisionIndex === 0 ? 'exit' : 'enter'
              : collisionIndex === 0 ? 'enter' : 'exit',
            gmId: e.meta.gmId,
            length,
          });
        });
        startInside && (e.meta.index === 0) && npc.anim.wayMetas.unshift({
          key: 'decor-collide',
          index: e.meta.index,
          decorKey: decor.key,
          type: 'start-inside', // start walk inside
          gmId: e.meta.gmId,
          length: e.meta.length,
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
            key: 'pre-npcs-collide',
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

  //#region handle door/npc events
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
      switch (e.key) {
        case 'decors-added':
        case 'decors-removed':
        case 'npc-clicked':
        case 'npc-internal':
        case 'removed-npc':
          break;
        case 'decor-click':
          mockHandleDecorClick(e, api);
          break;
        case 'disabled':
          api.fov.mapAct('pause');
          break;
        case 'enabled':
          api.fov.mapAct('resume');
          break;
        case 'fov-changed':
          // console.log(e);
          api.npcs.updateLocalDecor({ added: e.added, removed: e.removed, });
          break;
        case 'on-tty-link':
          mockOnTtyLink(e, api);
          break;
        case 'set-player':
          api.npcs.setPlayerKey(e.npcKey);
          break;
        case 'spawned-npc':
          // This event also happens on hot-reload NPC.jsx
          if (api.npcs.playerKey === e.npcKey) {
            api.fov.prev = { gmId: -1, roomId: -1, doorId: -1, openDoorsIds: [] };
            api.npcs.setRoomByNpc(e.npcKey);
          }
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
                setTimeout(() => cancelNpcs(npc.key, playerNpc.key), collision.seconds * 1000);
              }
            });
          } else if (playerNpc.isWalking()) {
            // Player may be about to collide with NPC
            const npc = api.npcs.getNpc(e.npcKey);
            const collision = npcService.predictNpcNpcCollision(playerNpc, npc);
            if (collision) {
              setTimeout(() => cancelNpcs(playerNpc.key, npc.key), collision.seconds * 1000);
            }
          }
          break;
        }
        case 'way-point':
          if (e.npcKey === api.npcs.playerKey) {
            state.handlePlayerWayEvent(e);
          }
          state.handleWayEvents(e);
          break;
        default:
          throw testNever(e, { suffix: 'npcsSub' });
      }
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
 * @property {(npc: NPC.NPC, e: NPC.NPCsWayEvent) => void} predictNpcDecorCollision
 * @property {(npc: NPC.NPC, e: NPC.NPCsWayEvent) => void} predictNpcNpcsCollision
 * @property {(e: NPC.NPCsWayEvent) => Promise<void>} handleWayEvents
 * @property {(e: NPC.NPCsWayEvent) => void} handlePlayerWayEvent
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
    if (decor.tags?.includes('label')) {
      /** Assume `[...tags, label, ...labelWords]` */
      const label = decor.tags.slice(decor.tags.findIndex(tag => tag === 'label') + 1).join(' ');
      const { gmId, roomId } = decodeDecorInstanceKey(decor.key);
      const gm = api.gmGraph.gms[gmId];
      const numDoors = gm.roomGraph.getAdjacentDoors(roomId).length;
      // Square brackets induces a link via `linkProviderDef`
      const line = `ℹ️  [${ansiColor.Blue}${label}${ansiColor.Reset}] with ${numDoors} door${numDoors > 1 ? 's' : ''}`;
      
      worldSessions.map(({ key: sessionKey }) => useSession.api.writeMsgCleanly(sessionKey, line, { ttyLinkCtxts: [{// Manually record where the link was
        lineText: line, 
        linkText: label,
        linkStartIndex: visibleUnicodeLength('ℹ️  ['),
        async callback() {
          // ℹ️ could have side effect e.g. panzoom
          const point = gm.matrix.transformPoint(gm.point[roomId].default.clone());
          await api.npcs.panZoomTo({ zoom: 2, ms: 2000, point });
          // ℹ️ return value is important
        },
      }] }));
    }
    api.npcs.config.logTags && worldSessions.map(({ key: sessionKey }) => useSession.api.writeMsgCleanly(
      sessionKey,
      `${ansiColor.White}tags: ${JSON.stringify(decor.tags??[])}${ansiColor.Reset}`,
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
    const point = gm.matrix.transformPoint(gm.point[ttyCtxt.roomId].default.clone());
    api.npcs.panZoomTo({ zoom: 2, ms: 2000, point });
  }
}