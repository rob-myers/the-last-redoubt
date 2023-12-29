import React from "react";
import { npcHeadRadiusPx, npcSlowWalkSpeedFactor } from "../world/const";
import { ansi } from '../service/const';
import { assertDefined, testNever } from "../service/generic";
import { decorToRef, queryDecorGridLine } from "../service/geomorph";
import { warn } from "../service/log";
import { stripAnsi } from "../sh/util";
import useSession from "../sh/session.store"; // 🤔 avoid dep?
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('./WorldPixi').State} api
 * @param {boolean} [disabled]
 */
export default function useHandleEvents(api, disabled) {

  const state = useStateRef(/** @type {() => State} */ () => ({

    handleDoorsEvent(e) {
      switch (e.key) {
        case 'closed-door':
          api.doors.mutateDoor(e.gmId, e.doorId, { open: false });
          api.geomorphs.onCloseDoor(e.gmId, e.doorId);
          api.fov.recompute();
          api.doors.renderDoor(e.gmId, e.doorId);
          break;
        case 'opened-door':
          api.doors.mutateDoor(e.gmId, e.doorId, { open: true });
          api.geomorphs.onOpenDoor(e.gmId, e.doorId);
          api.fov.recompute();
          api.doors.renderDoor(e.gmId, e.doorId);
          break;
        case 'locked-door':
          api.doors.mutateDoor(e.gmId, e.doorId, { locked: true });
          api.doors.renderDoor(e.gmId, e.doorId);
          break;
        case 'unlocked-door':
          api.doors.mutateDoor(e.gmId, e.doorId, { locked: false });
          api.doors.renderDoor(e.gmId, e.doorId);
          break;
        default:
          throw testNever(e.key);
      }
    },

    async handleNpcEvent(e) {
      switch (e.key) {
        case 'spawned-npc':
          api.debug.removeNavPath(api.lib.getNavPathName(e.npcKey));
          api.debug.render();
          break;
        case 'changed-speed': {
          const npc = api.npcs.getNpc(e.npcKey);
          if (npc.isWalking()) {
            // recompute pending npc collisions (but not decor collisions)
            npc.filterWayMetas((meta) => meta.key === 'npcs-collide');
            state.predictNpcNpcsCollision(npc);
            // recompute timeout now speed has changed
            window.clearTimeout(npc.anim.wayTimeoutId);
            npc.nextWayTimeout();
            // close npcs should recompute respective collision
            for (const other of api.npcs.getCloseNpcs(npc.key)) {
              other.filterWayMetas(meta => meta.key === 'npcs-collide' && meta.otherNpcKey === npc.key);
              state.predictNpcNpcCollision(other, npc);
            }
          }
          break;
        }
        case 'decor-click':
          mockHandleDecorClick(e, api);
          break;
        case 'disabled':
          api.disabled = true;
          api.fov.mapAct('pause');
          // api.panZoom.animationAction('pause');
          api.panZoom.viewport.plugins.pause('animate'); // 🚧
          api.panZoom.viewport.plugins.pause('follow');
          api.setTicker(false);
          break;
        case 'enabled':
          api.disabled = false;
          api.fov.mapAct('resume');
          if (!api.npcs.isPanZoomControlled()) {
            // only resume when not controlled by e.g. `view` or `track`
            api.panZoom.viewport.plugins.resume('animate'); // 🚧
            api.panZoom.viewport.plugins.resume('follow');
          }
          api.setTicker(true);
          break;
        case 'fov-changed':
          // console.log(e);
          api.debug.updateDebugRoom();
          break;
        case 'on-tty-link':
          mockOnTtyLink(e, api);
          break;
        case 'started-walking':
          // Also overwrites extended path
          api.debug.addNavPath(api.lib.getNavPathName(e.npcKey), e.navPath);
          api.debug.render();
          // remove stale pending collisions
          for (const other of api.npcs.getCloseNpcs(e.npcKey, true)) {
            other.filterWayMetas(meta => meta.key === 'npcs-collide' && meta.otherNpcKey === e.npcKey);
          }
          break;
        case 'stopped-walking': {
          const npc = api.npcs.getNpc(e.npcKey);
          for (const other of api.npcs.getCloseNpcs(e.npcKey, true)) {
            other.filterWayMetas(meta => meta.key === 'npcs-collide' && meta.otherNpcKey === npc.key);
            state.predictNpcNpcCollision(other, npc);
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
        case 'set-player':
        case 'resumed-track':
          break;
        default:
          throw testNever(e, { suffix: 'npcsSub' });
      }
    },

    async handlePlayerEvent(e) {
      switch (e.key) {
        case 'spawned-npc':
          api.fov.forgetPrev();
          api.fov.setRoomByNpc(e.npcKey);
          break;
        case 'started-walking': {
          if (!e.continuous) {// Player warped to navPath start
            api.fov.setRoomByNpc(e.npcKey);
          }
          break;
        }
        case 'stopped-walking':
          break;
        case 'way-point':
          state.handlePlayerWayEvent(e);
          break;
        case 'changed-speed':
        case 'npc-clicked':
        case 'npc-internal':
        case 'removed-npc':
        case 'set-player':
        case 'resumed-track':
          break;
        default:
          throw testNever(e, { suffix: 'npcsSub' });
      }
    },

    handlePanZoomEvents(e) {
      switch (e.key) {
        case 'pointerup':
          // mutate meta on click door/decor/debug
          const meta = api.geomorphs.getHitMeta(e.point);
          Object.assign(e.meta, meta);

          // mutate meta on click npc
          // 🚧 restrict to gmRoomId
          // 🚧 trigger 'npc-clicked'?
          for (const npc of Object.values(api.npcs.npc)) {
            if (npc.getPosition().distanceTo(e.point) < npcHeadRadiusPx) {
              Object.assign(e.meta, { npc: true, npcKey: npc.key });
              break;
            }
          }

          if (e.meta.debug) {
            api.debug.onClick(e);
          }
          break;
        case 'pointermove': {
          const meta = api.geomorphs.getHitMeta(e.point);
          api.setCursor(meta ? 'pointer' : 'auto');
          // meta && console.log('pointermove', meta);
          break;
        }
      }
    },

    async handleWayEvents(e) {
      // console.warn('handleWayEvents', e.npcKey, e.meta);
      const npc = api.npcs.getNpc(e.npcKey);

      switch (e.meta.key) {
        case 'npcs-collide':
          await stopNpcs(e.npcKey, e.meta.otherNpcKey);
          break;
        case 'vertex':
          npc.gmRoomId = npc.anim.gmRoomIds[e.meta.index] ?? npc.gmRoomId;

          if ((e.meta.index + 1) === npc.anim.path.length) {
            break; // npc at final vertex
          }
          
          // npc is walking along a line segment
          npc.updateWalkSegBounds(e.meta.index);
          state.predictNpcNpcsCollision(npc);
          state.predictNpcDecorCollision(npc);
          break;
        case 'at-door': {
          const { gmId, doorId } = e.meta;
          if (!api.doors.lookup[gmId][doorId].open) {
            await npc.cancel(); // At closed door
          }
          break;
        }
        case 'exit-room':
          // npc.updateRoomWalkBounds(e.meta.index);
          break;
        case 'decor-collide': {
          const { decor, type } = e.meta;
          decor.meta.doorSensor && state.onTriggerDoorSensor(
            npc, type, e.meta.gmId, /** @type {number} */ (decor.meta.doorId)
          );
          break;
        }
        case 'enter-room': {
          if (npc.anim.doorStrategy !== 'none') {
             // Currently, all other strategies slow near door
             npc.setSpeedFactor(npc.anim.defaultSpeedFactor);
          }

          const { gmId, doorId, enteredRoomId, otherRoomId } = e.meta;

          // handle exit-room into doorway then turn around and enter-room
          const firstGmRoomId = npc.anim.gmRoomIds[0];
          if (npc.gmRoomId && firstGmRoomId.gmId === npc.gmRoomId.gmId && firstGmRoomId.roomId === npc.gmRoomId.roomId) {
            break;
          }

          const prevGmRoom = api.gmGraph.getAdjacentGmRoom(gmId, enteredRoomId, doorId, otherRoomId === null);
          prevGmRoom && api.decor.getDecorAtPoint(
            npc.getPosition(), prevGmRoom.gmId, prevGmRoom.roomId,
          ).forEach(decor =>
            api.npcs.events.next({ key: 'way-point', npcKey: e.npcKey, meta: {
              key: 'decor-collide',
              type: 'exit',
              decor: decorToRef(decor),
              gmId: prevGmRoom.gmId,
              index: -1,
              length: 0,
            }})
          );

          // 'enter' after 'exit'
          api.decor.getDecorAtPoint(
            npc.getPosition(), gmId, enteredRoomId,
          ).forEach(decor =>
            api.npcs.events.next({ key: 'way-point', npcKey: e.npcKey, meta: {
              key: 'decor-collide',
              type: 'enter',
              decor: decorToRef(decor),
              gmId,
              index: -1,
              length: 0,
            }})
          );

          break;
        }
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

    predictNpcDecorCollision(npc) {
      /**
       * We restrict to decor in npc's current room.
       * - if start in doorway, this is next room or some adjacent.
       * - if walking through doorway, this is previous room.
       */
      if (npc.gmRoomId === null) {
        return warn(`predictNpcDecorCollision: npc ${npc.key} not inside any room`);
      }
      const { gmId, roomId } = npc.gmRoomId;
      
      const { aux, path } = npc.anim;
      const currPosition = npc.getPosition();
      const currLength = aux.sofars[aux.index] + path[aux.index].distanceTo(currPosition);

      // const closeDecor = api.decor.byRoom[gmId]?.[roomId]?.colliders ?? [];
      const closeDecor = queryDecorGridLine(
        currPosition,
        npc.anim.path[aux.index + 1],
        api.decor.byGrid,
      ).filter(d => d.meta.gmId === gmId && d.meta.roomId === roomId);

      for (const decor of closeDecor) {
        const { collisions, startInside } = decor.type === 'circle'
          ? api.lib.predictNpcCircleCollision(npc, decor)
          : api.lib.predictNpcPolygonCollision(
              npc,
              assertDefined(decor.derivedPoly?.outline),
              assertDefined(decor.derivedBounds),
            )
        ;

        if (collisions.length || startInside) {// 🚧 debug
          console.warn(`${npc.key} collide decor ${decor.type} ${decor.key}`, startInside, collisions);
        }
        
        collisions.forEach((collision, collisionIndex) => {
          const length = currLength + collision.distA;
          const insertIndex = npc.anim.wayMetas.findIndex(x => x.length >= length);
          npc.anim.wayMetas.splice(insertIndex, 0, {
            key: 'decor-collide',
            index: aux.index,
            decor: decorToRef(decor),
            type: startInside
              ? collisionIndex === 0 ? 'exit' : 'enter'
              : collisionIndex === 0 ? 'enter' : 'exit',
            gmId,
            length,
          });
        });

        startInside && aux.index === 0 && npc.anim.wayMetas.unshift({
          key: 'decor-collide',
          index: aux.index,
          decor: decorToRef(decor),
          type: 'start-inside', // start walk inside
          gmId,
          length: currLength,
        });
      }
    },

    predictNpcNpcCollision(npc, otherNpc) {
      const collision = api.lib.predictNpcNpcCollision(npc, otherNpc);

      if (collision) {
        const { aux, path, wayMetas } = npc.anim;
        console.warn(`${npc.key} will collide with ${otherNpc.key}`, collision);

        const length = aux.sofars[aux.index] + (
          npc.getPosition().distanceTo(path[aux.index]) // always account for offset
        ) + collision.distA;
        const insertIndex = wayMetas.findIndex(x => x.length >= length);
        const { gmId } = wayMetas[0];

        wayMetas.splice(insertIndex, 0, {// Add wayMeta cancelling motion
          key: 'npcs-collide',
          index: aux.index,
          otherNpcKey: otherNpc.key,
          gmId,
          length,
        });

        if (insertIndex === 0) {
          window.clearTimeout(npc.anim.wayTimeoutId);
          npc.nextWayTimeout();
        }
      }
    },

    predictNpcNpcsCollision(npc) {
      for (const other of api.npcs.getCloseNpcs(npc.key)) {
        state.predictNpcNpcCollision(npc, other);
      }
    },

    onTriggerDoorSensor(npc, event, gmId, doorId) {
      if (npc.key === api.npcs.playerKey) {
        if (event === 'enter') {
          api.fov.recompute();
        } else if (event === 'exit') {
          api.fov.recompute();
        }
      }
      if (event !== 'exit' && doorId === npc.getNextDoorId()) {
        state.preWalkThroughDoor(npc, gmId, doorId)
      }
    },

    async preWalkThroughDoor(npc, gmId, nextDoorId) {
      if (npc.anim.doorStrategy !== 'none') {
        // Currently, all open strategies slow down near door
        // 🚧 setTimeout avoids jerk?
        setTimeout(() => npc.setSpeedFactor(npcSlowWalkSpeedFactor), 30);
      }
      
      const { locked } = api.doors.lookup[gmId][nextDoorId];

      switch (npc.anim.doorStrategy) {
        case 'open': // Always try to walk through open locked doors
          if (!locked || npc.has.key[gmId][nextDoorId]) {
            api.doors.toggleDoor(gmId, nextDoorId, { open: true, npcKey: npc.key });
          }
          break;
        case 'safeOpen': // Always stop at locked inaccessible doors
          if (locked && !npc.has.key[gmId][nextDoorId]) {
            await npc.cancel();
          } else {
            api.doors.toggleDoor(gmId, nextDoorId, { open: true, npcKey: npc.key });
          }
          break;
        case 'forceOpen': // Act as though have skeleton key
          api.doors.toggleDoor(gmId, nextDoorId, { open: true });
          break;
        case 'none':
          break;
      }
    },
  }), {
    deps: [api.gmGraph],
  });

  //#region bootstrap on world ready
  const worldReady = api.isReady();

  React.useEffect(() => {
    if (!worldReady) {
      return;
    }

    // Update doors and lights on change
    const doorsSub = api.doors.events.subscribe((e) =>
      state.handleDoorsEvent(e)
    );

    // React to NPC events
    const npcsSub = api.npcs.events.subscribe((e) => {
      if ('npcKey' in e && (e.npcKey === api.npcs.playerKey)) {
        state.handlePlayerEvent(e);
      }
      state.handleNpcEvent(e);
    });

    // React to PanZoom events
    const panZoomSub = api.panZoom.events.subscribe((e) => 
      state.handlePanZoomEvents(e)
    );

    api.debug.render(); // Initial debug render

    return () => {
      doorsSub.unsubscribe();
      npcsSub.unsubscribe();
      panZoomSub.unsubscribe();
    };
  }, [worldReady]);

  React.useMemo(() => {
    if (worldReady) {
      api.npcs.events.next({ key: disabled ? 'disabled' : 'enabled' });
    } else {// Start ticker early for loading tweens
      api.setTicker(true);
    }
  }, [worldReady, disabled]);
  //#endregion

  /** @param {...string} npcKeys */
  function stopNpcs(...npcKeys) {
    /** Npcs which are walking but not paused.  */
    const walkingNpcs = npcKeys.map(key => api.npcs.npc[key]).filter(x => x?.isWalking(true));
    return Promise.all(walkingNpcs.map(x => x.cancel()));
  }

}

/**
 * @typedef State @type {object}
 * @property {(npc: NPC.NPC) => void} predictNpcDecorCollision
 * @property {(npc: NPC.NPC, otherNpc: NPC.NPC) => void} predictNpcNpcCollision
 * @property {(npc: NPC.NPC) => void} predictNpcNpcsCollision
 * @property {(npc: NPC.NPC, event: NPC.NpcWayMetaDecorCollide['type'], gmId: number, doorId: number) => void} onTriggerDoorSensor
 * @property {(npc: NPC.NPC, gmId: number, nextDoorId: number) => Promise<void>} preWalkThroughDoor
 * On 'enter' or 'start-inside' doorSensor of next door in current walk
 * @property {(e: import('./Doors').DoorMessage) => void} handleDoorsEvent
 * @property {(e: NPC.NPCsEvent) => Promise<void>} handleNpcEvent Handle NPC event (always runs)
 * @property {(e: PanZoom.InternalEvent) => void} handlePanZoomEvents
 * @property {(e: NPC.NPCsEventWithNpcKey) => Promise<void>} handlePlayerEvent
 * Handle Player NPC events (only runs when e.npcKey is playerKey)
 * @property {(e: NPC.NPCsWayEvent) => void} handlePlayerWayEvent
 * @property {(e: NPC.NPCsWayEvent) => Promise<void>} handleWayEvents
 */

/**
 * 🚧 mock
 * @param  {NPC.NPCsEvent & { key: 'decor-click' }} event
 * @param  {Pick<import('./WorldPixi').State, 'gmGraph' | 'npcs'>} api
 */
function mockHandleDecorClick({ decor }, api) {
  const worldSessions = Object.values(api.npcs.session).filter(({ receiveMsgs }) => receiveMsgs);

  if (decor.type === 'point') {
    api.npcs.config.logTags && worldSessions.map(({ key: sessionKey }) => useSession.api.writeMsgCleanly(
      sessionKey,
      `${ansi.BrightGreen}ℹ️  ${Object.entries(decor.meta??{}).map(([k, v]) => `${k} ${ansi.BrightYellow}${v}${ansi.BrightGreen}`).join('; ')}${ansi.Reset}`,
    ));
  }

  if (decor.type === 'point' && decor.meta.label) {
    const label = `${decor.meta.label}`;
    const gmId = /** @type {number} */ (decor.meta.gmId);
    const roomId = /** @type {number} */ (decor.meta.roomId);
    const gm = api.gmGraph.gms[gmId];
    const numDoors = gm.roomGraph.getAdjacentDoors(roomId).length;
    // Square brackets induces a link via `linkProviderDef`
    const line = `ℹ️  [ ${ansi.Blue}${label}${ansi.Reset} ] with ${numDoors} door${numDoors > 1 ? 's' : ''}`;
    
    worldSessions.map(({ key: sessionKey }) => useSession.api.writeMsgCleanly(sessionKey, line, { ttyLinkCtxts: [{// Manually record where the link was
      lineText: stripAnsi(line),
      linkText: stripAnsi(label),
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

}

/**
 * 🚧 mock
 * @param {NPC.NPCsEvent & { key: 'on-tty-link' }} event
 * @param  {Pick<import('./WorldPixi').State, 'gmGraph' | 'npcs'>} api
 */
function mockOnTtyLink(event, api) {
  const ttyCtxt = event.ttyCtxt;
  if (ttyCtxt.key === 'room') {
    const gm = api.gmGraph.gms[ttyCtxt.gmId];
    const point = gm.matrix.transformPoint(gm.rooms[ttyCtxt.roomId].center);
    api.npcs.panZoomTo({ zoom: 2, ms: 2000, point });
  }
}