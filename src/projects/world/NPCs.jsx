import React from "react";
import { css, cx } from "@emotion/css";
import { merge, of, Subject, firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";

import { Vect } from "../geom";
import { stripAnsi } from "../sh/util";
import { dataChunk, proxyKey } from "../sh/io";
import { assertDefined, assertNonNull, keys, testNever } from "../service/generic";
import { cssName, defaultNpcClassKey, defaultNpcInteractRadius, obscuredNpcOpacity, spawnFadeMs } from "../service/const";
import { geom } from "../service/geom";
import { getDecorInstanceKey, getGmRoomKey } from "../service/geomorph";
import * as npcService from "../service/npc";
import { detectReactDevToolQuery, getNumericCssVar, supportsWebp } from "../service/dom";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useSessionStore from "../sh/session.store";
import { MemoizedNPC } from "./NPC";
import createNpc from "./create-npc";

import npcsMeta from './npcs-meta.json';

/** @param {Props} props */
export default function NPCs(props) {

  const { api } = props;
  const update = useUpdate();

  const state = useStateRef(/** @type {() => State} */ () => ({
    events: new Subject,
    npc: {},

    playerKey: /** @type {null | string} */ (null),
    rootEl: /** @type {HTMLDivElement} */ ({}),
    ready: true,
    session: {},

    config: /** @type {Required<NPC.NpcConfigOpts>} */ (new Proxy(({
      omnipresent: /** @type {boolean} */ (false),
    }), {
      /** @param {keyof NPC.NpcConfigOpts | typeof proxyKey | 'toJSON'} key */
      get(ctxt, key) {
        if (detectReactDevToolQuery(key)) {
          return ctxt[key];
        }
        const rootStyle = state.rootEl.style;
        const debugStyle = api.debug.rootEl.style;
        switch (key) {
          case 'canClickArrows': return debugStyle.getPropertyValue(cssName.debugDoorArrowPtrEvts) === 'none' ? false : true;
          case 'debug': return rootStyle.getPropertyValue(cssName.npcsDebugDisplay) === 'none' ? false : true;
          case 'debugPlayer': return rootStyle.getPropertyValue(cssName.npcsDebugPlayerDisplay) === 'none' ? false : true;
          case 'gmOutlines': return debugStyle.getPropertyValue(cssName.debugGeomorphOutlineDisplay) === 'none' ? false : true;
          case 'interactRadius': return parseInt(rootStyle.getPropertyValue(cssName.npcsInteractRadius));
          case 'highlightWindows': return debugStyle.getPropertyValue(cssName.debugHighlightWindows) === 'none' ? false : true;
          case 'localNav': return debugStyle.getPropertyValue(cssName.debugRoomNavDisplay) === 'none' ? false : true;
          case 'localOutline': return debugStyle.getPropertyValue(cssName.debugRoomOutlineDisplay) === 'none' ? false : true;
          case 'omnipresent': return !!ctxt.omnipresent;
          case 'showIds': return debugStyle.getPropertyValue(cssName.debugShowIds) === 'none' ? false : true;
          case 'configKey':
          case 'decorKey':
          case 'mapAction':
          case 'npcKey':
          case 'suppressThrow':
            return undefined;
          case proxyKey: return true;
          case 'toJSON': return () => '{}'; // 🚧
          default: throw testNever(key, { suffix: 'config.get' });
        }
      },
      /** @param {keyof NPC.NpcConfigOpts} key */
      set(ctxt, key, value) {
        const rootStyle = state.rootEl.style;
        const debugStyle = api.debug.rootEl.style;
        switch (key) {
          case 'canClickArrows': debugStyle.setProperty(cssName.debugDoorArrowPtrEvts, value ? 'all' : 'none'); break;
          case 'debug': rootStyle.setProperty(cssName.npcsDebugDisplay, value ? 'initial' : 'none'); break;
          case 'debugPlayer': rootStyle.setProperty(cssName.npcsDebugPlayerDisplay, value ? 'initial' : 'none'); break;
          case 'gmOutlines': debugStyle.setProperty(cssName.debugGeomorphOutlineDisplay, value ? 'initial' : 'none'); break;
          case 'highlightWindows': debugStyle.setProperty(cssName.debugHighlightWindows, value ? 'initial' : 'none'); break;
          case 'interactRadius': rootStyle.setProperty(cssName.npcsInteractRadius, `${value}px`); break;
          case 'localNav': debugStyle.setProperty(cssName.debugRoomNavDisplay, value ? 'initial' : 'none'); break;
          case 'localOutline': debugStyle.setProperty(cssName.debugRoomOutlineDisplay, value ? 'initial' : 'none'); break;
          case 'omnipresent': ctxt.omnipresent = !!value; break;
          case 'showIds': debugStyle.setProperty(cssName.debugShowIds, value ? 'initial' : 'none'); break;
          case 'configKey':
          case 'decorKey':
          case 'mapAction':
          case 'npcKey':
          case 'suppressThrow':
            break;
          default:
            testNever(key, { suffix: 'config.set' });
        }
        return true;
      },
      ownKeys() {
        return [
          'canClickArrows',
          'debug',
          'gmOutlines',
          'highlightWindows',
          'interactRadius',
          'localNav',
          'localOutline',
          'omnipresent',
          'showIds',
        ];
      },
      getOwnPropertyDescriptor() {
        return { enumerable: true, configurable: true };
      },
    })),

    addTtyLineCtxts(sessionKey, lineText, ctxts) {
      // We strip ANSI colour codes for string comparison
      const strippedLine = stripAnsi(lineText);
      state.session[sessionKey].tty[strippedLine] = ctxts.map(x =>
        ({ ...x, lineText: strippedLine, linkText: stripAnsi(x.linkText) })
      );
    },
    cleanSessionCtxts() {// 🚧 should only run sporadically
      const sessions = Object.keys(state.session).map(
        sessionKey => useSessionStore.api.getSession(sessionKey)
      ).filter(Boolean);

      for (const session of sessions) {
        const lineLookup = session.ttyShell.xterm.getLines();
        const { tty } = state.session[session.key];
        Object.keys(tty).forEach(lineText =>
          !lineLookup[lineText] && delete tty[lineText]
        );
      }
    },
    async fadeSpawnDo(npc, e, meta) {
      try {
        await npc.animateOpacity(0, e.fadeOutMs ?? spawnFadeMs);
        e.point.meta ??= meta; // 🚧 can remove?
        await state.spawn(e);
        npc.startAnimationByMeta(meta);
        await npc.animateOpacity(meta.obscured ? obscuredNpcOpacity : 1, spawnFadeMs);
      } catch (e) {
        await npc.animateOpacity(npc.doMeta?.obscured ? obscuredNpcOpacity : 1, spawnFadeMs);
        throw e;
      }
    },
    getGlobalNavPath(src, dst) {
      const srcGmId = api.gmGraph.findGeomorphIdContaining(src);
      const dstGmId = api.gmGraph.findGeomorphIdContaining(dst);

      if (srcGmId === null || dstGmId === null) {
        throw Error(`getGlobalNavPath: src/dst must be inside some geomorph's aabb`)
      } else if (srcGmId === dstGmId) {
        const localNavPath = state.getLocalNavPath(srcGmId, src, dst);
        console.info('localNavPath (single)', localNavPath);
        return {
          key: 'global-nav',
          fullPath: localNavPath.fullPath.slice(),
          navMetas: localNavPath.navMetas.map(x => ({ ...x, gmId: localNavPath.gmId })),
          gmRoomIds: localNavPath.roomIds.map(roomId => [srcGmId, roomId]),
        };
      } else {
        // Compute global strategy i.e. edges in gmGraph
        const gmEdges = api.gmGraph.findPath(src, dst);
        if (!gmEdges) {
          throw Error(`getGlobalNavPath: gmGraph.findPath not found: ${JSON.stringify(src)} -> ${JSON.stringify(dst)}`);
        }
        // console.log('gmEdges', gmEdges); // DEBUG

        const fullPath = /** @type {Geom.Vect[]} */ ([]);
        const navMetas = /** @type {NPC.GlobalNavMeta[]} */ ([]);
        const gmRoomIds = /** @type {[number, number][]} */ ([]);

        for (let k = 0; k < gmEdges.length + 1; k++) {
          const localNavPath = k === 0
            // Initial
            ? state.getLocalNavPath(srcGmId, src, gmEdges[0].srcDoorEntry)
            : k < gmEdges.length
              // Intermediate
              ? state.getLocalNavPath(gmEdges[k - 1].dstGmId, gmEdges[k - 1].dstDoorEntry, gmEdges[k].srcDoorEntry)
              // Final
              : state.getLocalNavPath(dstGmId, gmEdges[k - 1].dstDoorEntry, dst);

          console.warn('localNavPath', k, localNavPath);

          const gmEdge = gmEdges[k];
          
          if (k === 0 && localNavPath.doorIds[0] >= 0) {
            // Started in hull door, so ignore `localNavPath`
            fullPath.push(Vect.from(src));
            gmRoomIds.push([srcGmId, localNavPath.roomIds[0]]);
            navMetas.push({ key: 'vertex', index: 0, gmId: srcGmId });
          } else if (k === gmEdges.length && localNavPath.doorIds[1] >= 0) {
            // Ended in hull door, so ignore `localNavPath`
            fullPath.push(Vect.from(dst));
            gmRoomIds.push([dstGmId, assertDefined(localNavPath.roomIds.at(-1))]);
            navMetas.push({ key: 'vertex', index: fullPath.length - 1, gmId: dstGmId });
          } else {
            const indexOffset = fullPath.length;
            fullPath.push(...localNavPath.fullPath);
            gmRoomIds.push(...localNavPath.roomIds.map(roomId => /** @type {[number, number]} */ ([localNavPath.gmId, roomId])));
            // Globalise local navMetas
            navMetas.push(...localNavPath.navMetas.map(meta => ({
              ...meta,
              index: indexOffset + meta.index,
              gmId: localNavPath.gmId,
            })));
          }

          if (gmEdge) {
            // Future nodes exist, so final 'vertex' no longer final
            delete /** @type {Graph.FloorGraphVertexNavMeta} */ (navMetas[navMetas.length - 1]).final;
            navMetas.push({
              key: 'exit-room',
              index: fullPath.length - 1,
              gmId: gmEdge.srcGmId,
              exitedRoomId: gmEdge.srcRoomId,
              doorId: gmEdge.srcDoorId,
              hullDoorId: gmEdge.srcHullDoorId,
              otherRoomId: null,
            });
          }
        }

        /** @type {Graph.FloorGraphVertexNavMeta} */ (
          navMetas[navMetas.length - 1]
        ).final = true;
        
        return {
          key: 'global-nav',
          fullPath,
          navMetas,
          gmRoomIds,
        };
      }
    },
    /**
     * Wraps @see {floorGraphClass.findPath}
     */
    getLocalNavPath(gmId, src, dst) {
      const gm = api.gmGraph.gms[gmId];
      const localSrc = gm.inverseMatrix.transformPoint(Vect.from(src));
      const localDst = gm.inverseMatrix.transformPoint(Vect.from(dst));
      const result = gm.floorGraph.findPath(localSrc, localDst);

      if (result) {
        return {
          key: 'local-nav',
          gmId,
          ...result,
          // Avoid geom.removePathReps because navMetas would have to be adjusted
          fullPath: result.fullPath.map(p => gm.matrix.transformPoint(Vect.from(p)).precision(3)),
        };
      } else {
        throw Error(`getLocalNavPath: no path found: ${JSON.stringify(src)} --> ${JSON.stringify(dst)}`);
      }
    },
    /**
     * Used by shell function `nav`. Wraps
     * @see {state.getGlobalNavPath}
     */
    getNpcGlobalNav(e) {
      const npc = state.npc[e.npcKey];
      const position = npc?.getPosition();
      if (!npc) {
        throw Error(`npcKey "${e.npcKey}" does not exist`);
      } else if (!(Vect.isVectJson(e.point))) {
        throw Error(`invalid point: ${JSON.stringify(e.point)}`);
      } else if (!state.isPointInNavmesh(e.point)) {
        if (e.throwOnNotNav) {
          throw Error(`dst outside navmesh: ${JSON.stringify(e.point)}`);
        } else {
          console.warn(`dst outside navmesh: ${JSON.stringify(e.point)} (returned empty path)`);
          return { key: 'global-nav', fullPath: [], navMetas: [] };
        }
      } else if (!state.isPointInNavmesh(position)) {
        console.warn(`npc is outside navmesh: ${JSON.stringify(position)}`);
        return { key: 'global-nav', fullPath: [], navMetas: [] };
      }
      const result = state.getGlobalNavPath(position, e.point);
      // Always show path
      api.decor.setDecor({ type: 'path', key: `${e.npcKey}-navpath`, meta: { /** 🚧 */ }, path: result.fullPath });
      return result;
    },
    getNpcInteractRadius() {
      return getNumericCssVar(state.rootEl, cssName.npcsInteractRadius);
    },
    getNpc(npcKey) {
      const npc = state.npc[npcKey];
      if (!npc) {
        throw Error(`npc "${npcKey}" does not exist`);
      }
      return npc;
    },
    getNpcsIntersecting(convexPoly) {
      const extraForWalk = 20;
      return Object.values(state.npc)
        .filter(x => geom.circleIntersectsConvexPolygon(
          x.getPosition(),
          x.getRadius() + (x.isWalking() ? extraForWalk : 0),
          convexPoly
        ));
    },
    getPlayer() {
      return state.playerKey ? state.getNpc(state.playerKey) : null;
    },
    handleBunkBedCollide(nearbyMeta, dstMeta) {
      return (
        // Collide if same height (undefined except at bunk-beds)
        (nearbyMeta?.height === dstMeta?.height)
        // Height differs; collide if exactly one "do point" and obscured
        || (
          (!!nearbyMeta !== !!dstMeta?.do)
          && !assertDefined(nearbyMeta || dstMeta).obscured
        )
      );
    },
    handleLongRunningNpcProcess(process, npcKey) {
      state.getNpc(npcKey); // Throws if non-existent
      const cb = {
        cleanup() {
          state.npcAct({ npcKey, action: "cancel" }).catch(_e => void {});
        },
        suspend() {
          state.npcAct({ npcKey, action: "pause", cause: 'process-suspend' });
          return true;
        },
        resume() {
          state.npcAct({ npcKey, action: "resume", cause: 'process-resume' });
          return true;
        },
      };
      process.cleanups.push(cb.cleanup);
      process.onSuspends.push(cb.suspend);
      process.onResumes.push(cb.resume);
      return () => {
        // suspend/resume typically need to persist across Tabs pause/resume.
        // However, may need to remove them e.g. if npcKey changes in `foo | npc do`
        process.onSuspends.splice(process.onSuspends.indexOf(cb.suspend), 1);
        process.onResumes.splice(process.onResumes.indexOf(cb.resume), 1);
      };
    },
    isPointNearClosedDoor(point, radius, gmRoomId) {
      const gm = api.gmGraph.gms[gmRoomId.gmId];
      const localPoint = gm.inverseMatrix.transformPoint({...point});
      const closeDoor = gm.roomGraph.getAdjacentDoors(gmRoomId.roomId).find(({ doorId }) => 
        !api.doors.open[gmRoomId.gmId][doorId] &&
        // 🚧 check distance from line segment instead?
        geom.createOutset(gm.doors[doorId].poly, radius)[0].contains(localPoint)
      );
      return !!closeDoor;
    },
    isPointInNavmesh(p) {
      const gmId = api.gmGraph.findGeomorphIdContaining(p);
      if (gmId !== null) {
        const { navPoly, inverseMatrix } = api.gmGraph.gms[gmId];
        const localPoint = inverseMatrix.transformPoint(Vect.from(p));
        return navPoly.some(poly => poly.contains(localPoint));
      } else {
        return false;
      }
    },
    isPointSpawnable(npcKey, npcClassKey = defaultNpcClassKey, point) {
      /** @type {NPC.NPC} */ let otherNpc;
      for (const otherNpcKey in state.npc) {
        if (
          otherNpcKey !== npcKey
          && (otherNpc = state.npc[otherNpcKey]).intersectsCircle(
            point,
            npcsMeta[npcClassKey].radius
          )
          && state.handleBunkBedCollide(otherNpc.doMeta ?? undefined, point.meta)
        ) {
          return false;
        }
      }
      // Must be inside some room
      const result = api.gmGraph.findRoomContaining(point);
      if (!result) {
        return false;
      }
      // Door rects cannot be close
      const npcRadius = npcsMeta[npcClassKey].radius;
      if (state.isPointNearClosedDoor(point, npcRadius, result)) {
        return false;
      }
      return true;
    },
    async npcAct(e) {
      switch (e.action) {
        case 'add-decor': // add decor(s)
          return api.decor.setDecor(...e.items);
        case 'decor':
          return 'decorKey' in e
            ? api.decor.decor[e.decorKey] // get decor
            : Object.keys(e).length === 1
              ? Object.values(api.decor.decor) // list all decors
              : api.decor.setDecor(e); // add decor
        case 'do':
          await state.npcActDo(e);
          break;
        case 'cancel':
          return await state.getNpc(e.npcKey).cancel();
        case 'config': // set multiple, toggle single, get all
          keys(e).forEach(key => // Set
            // 🚧 ensure correct type
            e[key] !== undefined && (/** @type {*} */ (state.config)[key] = e[key])
          );
          if (e.configKey) {// Toggle (possibly many) booleans
            const configKeys = e.configKey.split(' ').filter(npcService.isConfigBooleanKey);
            configKeys.forEach(configKey => state.config[configKey] = !state.config[configKey]);
          }
          if (Object.keys(e).length === 1) {// `npc config` (only key is `action`)
            /**
             * We must wrap the proxy in a chunk to avoid errors arising
             * from various `await`s ("then" is not defined).
             */
            return dataChunk([state.config]);
          }
          break;
        case 'events': // handled earlier
          break;
        case 'get':
          return state.getNpc(e.npcKey);
        case 'look-at': {
          const npc = state.getNpc(e.npcKey);
          if (!Vect.isVectJson(e.point)) {
            throw Error(`invalid point: ${JSON.stringify(e.point)}`);
          }
          if (npc.canLook()) {
            await npc.lookAt(e.point);
          }
          return npc.getAngle();
        }
        case 'map':
          return api.fov.mapAct(e.mapAction, e.timeMs);
        case 'pause':// Pause current animation
          state.getNpc(e.npcKey).pause(e.cause === 'process-suspend');
          break;
        case 'resume':// Resume current animation
          state.getNpc(e.npcKey).resume(e.cause === 'process-resume');
          break;
        case 'rm':
        case 'remove':
          return state.removeNpc(e.npcKey);
        case 'remove-decor':
        case 'rm-decor':
          if (e.decorKey) {
            api.decor.removeDecor(...e.decorKey.split(' '));
          }
          if (e.items) {
            api.decor.removeDecor(...e.items);
          }
          if (e.regexStr) {
            const keyRegex = new RegExp(e.regexStr);
            api.decor.removeDecor(
              ...Object.keys(api.decor.decor).filter(decorKey => keyRegex.test(decorKey))
            );
          }
          break;
        case 'set-player':
          state.events.next({ key: 'set-player', npcKey: e.npcKey??null });
          break;
        default:
          throw Error(testNever(e, { override: `unrecognised action: "${JSON.stringify(e)}"` }));
      }
    },
    async npcActDo(e) {
      const npc = state.getNpc(e.npcKey);
      const point = e.point;
      point.meta ??= {}; // possibly manually specified (not via `click [n]`)
      
      try {
        if (state.isPointInNavmesh(npc.getPosition())) {
          await state.onMeshDoMeta(npc, e);
        } else {
          await state.offMeshDoMeta(npc, e);
        }
        npc.doMeta = point.meta.do ? point.meta : null;
      } catch (e) {
        if (e instanceof Error && e.message === 'cancelled') {
          // Swallow 'cancelled' errors e.g. start new walk, obstruction
          // All errors can be swallowed via `npc do '{ suppressThrow: true }'`
        } else {
          throw e;
        }
      }
    },
    async offMeshDoMeta(npc, e) {
      const src = npc.getPosition();
      const point = e.point;

      if (!e.suppressThrow && !point.meta.do && !point.meta.nav) {
        throw Error('not doable nor navigable');
      }

      if (!e.suppressThrow && (
        src.distanceTo(point) > npc.getInteractRadius()
        || !api.gmGraph.inSameRoom(src, point)
      )) {
        throw Error('too far away');
      }

      await state.fadeSpawnDo(npc, {
        npcKey: npc.key,
        point: point.meta.nav
          ? point // if not navigable try use targetPoint:
          : { ...point, .../** @type {Geom.VectJson} */ (point.meta.targetPos) },
        angle: point.meta.nav
          // use direction src --> point if entering navmesh
          ? src.equals(point) ? undefined : Vect.from(point).sub(src).angle
          // use meta.orient if staying off-mesh
          : typeof point.meta.orient === 'number' ? point.meta.orient * (Math.PI / 180) : undefined,
        fadeOutMs: e.fadeOutMs,
      }, point.meta);
    },
    async onMeshDoMeta(npc, e) {
      const meta = e.point.meta;
      /** The actual "do point" (point is somewhere on icon) */
      const decorPoint = /** @type {Geom.VectJson} */ (meta.targetPos) ?? e.point;

      if (!e.suppressThrow && !meta.do) {
        throw Error('not doable');
      }

      if (state.isPointInNavmesh(decorPoint)) {// Walk, [Turn], Do
        const navPath = state.getNpcGlobalNav({ npcKey: npc.key, point: decorPoint, throwOnNotNav: true });
        await state.walkNpc({ npcKey: npc.key, throwOnCancel: true, ...navPath });
        typeof meta.orient === 'number' && await npc.animateRotate(meta.orient * (180 / Math.PI), 100);
        npc.startAnimationByMeta(meta);
        return;
      }

      if (!e.suppressThrow && !(npc.getPosition().distanceTo(e.point) <= npc.getInteractRadius())) {
        throw Error('too far away');
      }

      await state.fadeSpawnDo(npc, {
        npcKey: npc.key,
        point: { ...e.point, ...decorPoint },
        angle: typeof meta.orient === 'number' ? meta.orient * (Math.PI / 180) : undefined,
        requireNav: false,
        fadeOutMs: e.fadeOutMs,
      }, meta);
    },
    onTtyLink(sessionKey, lineText, linkText, linkStartIndex) {
      // console.log('onTtyLink', { lineNumber, lineText, linkText, linkStartIndex });
      state.cleanSessionCtxts();
      const found = state.session[sessionKey]?.tty[lineText]?.find(x =>
        x.linkStartIndex === linkStartIndex
        && x.linkText === linkText
      );
      if (found) {
        state.events.next({ key: 'on-tty-link', linkText, linkStartIndex, ttyCtxt: found });
      }
    },
    async panZoomTo(e) {
      if (!e || (e.zoom && !Number.isFinite(e.zoom)) || (e.point && !Vect.isVectJson(e.point)) || (e.ms && !Number.isFinite(e.ms))) {
        throw Error(`expected format: { zoom?: number; point?: { x: number; y: number }; ms: number; easing?: string }`);
      }
      try {
        await props.api.panZoom.panZoomTo(e.zoom, e.point, e.ms, e.easing);
        return 'completed';
      } catch (e) {
        return 'cancelled';
      }
    },
    removeNpc(npcKey) {
      delete state.npc[npcKey];
      update();
      state.npcAct({ action: 'set-player', npcKey: undefined });
      // 🚧 inform relevant processes?
    },
    rootRef(el) {
      if (el) {
        state.rootEl = el;
        if (!api.npcs.ready) {
          /**
           * Why set CSS variables here, not in css`...` below?
           * 1. ts-styled-plugin error for ${cssName.foo}: ${bar};
           * 2. setting style avoids `getComputedStyle`
           */
          el.style.setProperty(cssName.npcsInteractRadius, `${defaultNpcInteractRadius}px`);
          el.style.setProperty(cssName.npcsDebugDisplay, 'none');
        }
      }
    },
    service: npcService,
    setPlayerKey(npcKey) {
      const nextPlayerKey = npcKey || null; // Forbid empty string

      if (state.playerKey) {
        const prevPlayer = api.npcs.npc[state.playerKey]; // Possibly undefined
        prevPlayer?.el.root.classList.remove('player'); // render instead?
      }
      if (nextPlayerKey) {
        const nextPlayer = state.getNpc(nextPlayerKey); // Player must exist
        nextPlayer.el.root.classList.add('player'); // render instead?
      }
      state.playerKey = nextPlayerKey;
    },
    setRoomByNpc(npcKey) {
      const npc = state.getNpc(npcKey);
      const position = npc.getPosition();
      const found = api.gmGraph.findRoomContaining(position);
      if (found) {
        const doorId = api.gmGraph.gms[found.gmId].doors.findIndex(x => x.roomIds.includes(found.roomId));
        props.api.fov.setRoom(found.gmId, found.roomId, doorId);
        return found;
      } else {// TODO error in terminal?
        console.error(`set-player ${npcKey}: no room contains ${JSON.stringify(position)}`)
        return null;
      }
    },
    async spawn(e) {
      if (!(e.npcKey && typeof e.npcKey === 'string' && e.npcKey.trim())) {
        throw Error(`invalid npc key: ${JSON.stringify(e.npcKey)}`);
      } else if (!(e.point && typeof e.point.x === 'number' && typeof e.point.y === 'number')) {
        throw Error(`invalid point: ${JSON.stringify(e.point)}`);
      } else if (e.requireNav && !state.isPointInNavmesh(e.point)) {
        throw Error(`cannot spawn outside navPoly: ${JSON.stringify(e.point)}`);
      } else if (e.npcClassKey && !npcService.isNpcClassKey(e.npcClassKey)) {
        throw Error(`invalid npcClassKey: ${JSON.stringify(e.npcClassKey)}`);
      }

      if (!state.isPointSpawnable(e.npcKey, e.npcClassKey, e.point)) {
        throw new Error('cancelled');
      }

      if (state.npc[e.npcKey]) {// Respawn
        const spawned = state.npc[e.npcKey];
        await spawned.cancel();
        spawned.unspawned = true; // Crucial for <NPC>
        spawned.epochMs = Date.now();
        spawned.def = {
          key: e.npcKey,
          angle: e.angle ?? spawned?.getAngle() ?? 0, // Previous angle fallback
          npcClassKey: spawned.classKey,
          position: e.point,
          speed: npcsMeta[spawned.classKey].speed,
        };
        if (e.npcClassKey) {
          spawned.changeClass(e.npcClassKey);
        }
        // Reorder keys
        delete state.npc[e.npcKey];
        state.npc[e.npcKey] = spawned;
        spawned.doMeta = e.point.meta?.do ? e.point.meta : null;
      } else {// Create
        const npcClassKey = e.npcClassKey || defaultNpcClassKey;
        state.npc[e.npcKey] = createNpc({
          key: e.npcKey,
          angle: e.angle ?? 0,
          npcClassKey: npcClassKey,
          position: e.point,
          speed: npcsMeta[npcClassKey].speed,
        }, { api });
        state.npc[e.npcKey].doMeta = e.point.meta?.do ? e.point.meta : null;
      }

      // Must subscribe before triggering <NPC> render
      const promise = firstValueFrom(state.events.pipe(
        filter(x => x.key === 'spawned-npc' && x.npcKey === e.npcKey)
      ));
      // Trigger <NPC> render and await reply
      update();
      await promise;
    },
    trackNpc(opts) {
      const { npcKey, process } = opts;
      const { panZoom } = props.api
      if (!state.npc[npcKey]) {
        throw Error(`npc "${npcKey}" does not exist`);
      }

      let status = /** @type {'no-track' | 'follow-walk' | 'panzoom-to'} */ ('no-track');

      return merge(
        of({ key: /** @type {const} */ ('init-track') }),
        state.events,
        panZoom.events,
      ).pipe(
        filter(x => (
          process.status === 1 && (
            x.key === 'init-track'
            || x.key === 'ui-idle'
            || x.key === 'resized-bounds'
            || x.key === 'cancelled-panzoom-to'
            || x.key === 'completed-panzoom-to'
            || (x.key === 'started-walking' && x.npcKey === npcKey)
            || (x.key === 'stopped-walking' && x.npcKey === npcKey)
          )
        )),
      ).subscribe({
        async next(msg) {
          // console.log('msg', msg); // DEBUG
          if (!panZoom.isIdle() && msg.key !== 'started-walking') {
            status = 'no-track';
            console.warn('@', status);
            return;
          }

          const npc = state.npc[npcKey];
          const npcPosition = npc.getPosition();
          
          // 🚧 assume only one moving spritesheet i.e. `walk`
          if (// npc not moving
            (npc.anim.spriteSheet !== 'walk')
            // camera not animating
            && (panZoom.anims[0] === null || ['finished', 'idle'].includes(panZoom.anims[0].playState))
            // camera not close
            && panZoom.distanceTo(npcPosition) > 10
          ) {
            status = 'panzoom-to';
            console.warn('@', status);
            // Ignore Error('cancelled')
            try {
              // const baseZoom = undefined;
              const baseZoom = 1.8;
              await panZoom.panZoomTo(baseZoom, npcPosition, 2000);
            } catch {};
            status = 'no-track';
          }

          if (msg.key === 'started-walking') {
            status = 'follow-walk';
            console.warn('@', status);
            /**
             * Skip this on Firefox Android (it is very jerky)?
             */
            try {
              const path = npc.getTargets().map(x => x.point);
              await panZoom.followPath(path, { animScaleFactor: npc.getAnimScaleFactor() });
            } catch {} // Ignore Error('cancelled')
          }
        },
      });
    },
    updateLocalDecor(opts) {
      for (const { gmId, roomId } of opts.added??[]) {
        const { decor: { [roomId]: decor }, matrix } = api.gmGraph.gms[gmId];
        const decorKeys = decor.map((_, decorId) => getDecorInstanceKey(gmId, roomId, decorId));
        state.npcAct({
          action: "add-decor",
          items: Object.values(decor).map(/** @returns {(typeof decor)[*]} */ (d, decorId) => {
            if (d.type === 'rect') {
              // 🚧 better way of computing transformed angledRect?
              const transformedPoly = assertDefined(d.derivedPoly).clone().applyMatrix(matrix).fixOrientation();
              const { angle, baseRect } = geom.polyToAngledRect(transformedPoly);
              return {
                ...d,
                ...baseRect,
                key: decorKeys[decorId], // Must override key, now we know gmId
                angle,
                meta: {...d.meta}, // Shallow clone
              };
            }
            if (d.type === 'circle') {
              return {
                ...d,
                key: decorKeys[decorId],
                center: matrix.transformPoint({ ...d.center }),
                meta: {...d.meta},
              };
            }
            // NPC.DecorPoint
            return {
              ...d,
              key: decorKeys[decorId],
              ...matrix.transformPoint({ x: d.x, y: d.y }),
              meta: {
                ...d.meta,
                // 🚧 cache?
                orient: typeof d.meta.orient === 'number'
                  ? Math.round(matrix.transformAngle(d.meta.orient * (Math.PI / 180)) * (180 / Math.PI))
                  : null,
                ui: true,
              },
            };
          }),
        });
      }
      for (const { gmId, roomId } of opts.removed??[]) {
        const points = api.gmGraph.gms[gmId].decor[roomId];
        const decorKeys = points.map((_, decorId) => getDecorInstanceKey(gmId, roomId, decorId))
        state.npcAct({ action: "rm-decor", items: decorKeys });
      }
    },
    async walkNpc(e) {
      const npc = state.getNpc(e.npcKey);
      if (!npcService.verifyGlobalNavPath(e)) {
        throw Error(`invalid global navpath format: ${JSON.stringify(e)}`);
      }

      try {// Walk along a global navpath
        const globalNavPath = e;
        const allPoints = globalNavPath.fullPath;
        // console.log('global navMetas', globalNavPath.navMetas); // DEBUG
        await npc.followNavPath(allPoints, {
          globalNavMetas: globalNavPath.navMetas,
          gmRoomKeys: globalNavPath.gmRoomIds?.map(([gmId, roomId]) => getGmRoomKey(gmId, roomId)),
        });

      } catch (err) {
        if (!e.throwOnCancel && err instanceof Error && err.message === 'cancelled') {
          console.info(`${e.npcKey}: walkNpc cancelled`);
        } else {
          throw err;
        }
      }
    },
    async writeToTtys(line, ttyCtxts) {
      const sessionCtxts = Object.values(props.api.npcs.session).filter(x => x.receiveMsgs);

      await Promise.all(sessionCtxts.map(async ({ key: sessionKey }) => {
        await useSessionStore.api.writeMsgCleanly(sessionKey, line);
        ttyCtxts && props.api.npcs.addTtyLineCtxts(sessionKey, line, ttyCtxts);
      }));
    },
  }), { deps: [api] });
  
  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <div
      className={cx('npcs', rootCss)}
      ref={state.rootRef}
    >
      {Object.values(state.npc).map(({ key, epochMs }) => (
        <MemoizedNPC
          key={key}
          api={props.api}
          epochMs={epochMs} // To override memoization
          npcKey={key}
        />
      ))}

      <PrefetchSpritesheets/>
    </div>
  );
}

const rootCss = css`
  /** For CSS variables see state.rootRef */

  position: absolute;
  canvas {
    position: absolute;
    pointer-events: none;
  }
  div.debug-npc {
    position: absolute;
    width: 30px;
    height: 30px;
    border-radius: 30px;
    border: 1px solid red;
    transform: translate(-15px, -15px);
  }
  svg {
    position: absolute;
    pointer-events: none;
  }
`;

/**
 * @typedef Props @type {object}
 * @property {import('../world/World').State} api
 * @property {(api: State) => void} onLoad
 */

/**
 * @typedef State @type {object}
 * @property {import('rxjs').Subject<NPC.NPCsEvent>} events
 * @property {Record<string, NPC.NPC>} npc
 *
 * @property {null | string} playerKey
 * @property {boolean} ready
 * @property {HTMLElement} rootEl
 * @property {{ [sessionKey: string]: NPC.SessionCtxt }} session
 * @property {Required<NPC.NpcConfigOpts>} config Proxy
 *
 * @property {(sessionKey: string, lineText: string, ctxts: NPC.SessionTtyCtxt[]) => void} addTtyLineCtxts
 * @property {() => void} cleanSessionCtxts
 * @property {(npc: NPC.NPC, opts: Parameters<State['spawn']>['0'] & { fadeOutMs?: number }, meta: Geomorph.PointMeta) => Promise<void>} fadeSpawnDo
 * @property {(src: Geom.VectJson, dst: Geom.VectJson) => NPC.GlobalNavPath} getGlobalNavPath
 * @property {(gmId: number, src: Geom.VectJson, dst: Geom.VectJson) => NPC.LocalNavPath} getLocalNavPath
 * @property {(e: { npcKey: string; point: Geom.VectJson; throwOnNotNav?: boolean }) => NPC.GlobalNavPath} getNpcGlobalNav
 * @property {() => number} getNpcInteractRadius
 * @property {(npcKey: string) => NPC.NPC} getNpc
 * @property {(convexPoly: Geom.Poly) => NPC.NPC[]} getNpcsIntersecting
 * @property {() => null | NPC.NPC} getPlayer
 * @property {(nearbyMeta?: Geomorph.PointMeta, dstMeta?: Geomorph.PointMeta) => boolean} handleBunkBedCollide Collide due to height/obscured?
 * @property {(process: import("../sh/session.store").ProcessMeta, npcKey: string) => undefined | (() => void)} handleLongRunningNpcProcess Returns cleanup
 * @property {(p: Geom.VectJson, radius: number, gmRoomId: Geomorph.GmRoomId) => boolean} isPointNearClosedDoor
 * Is the point near some door adjacent to specified room?
 * @property {(p: Geom.VectJson) => boolean} isPointInNavmesh
 * @property {(npcKey: string, npcClassKey: NPC.NpcClassKey | undefined, p: Geomorph.PointWithMeta) => boolean} isPointSpawnable
 * @property {(e: NPC.NpcAction) => Promise<NpcActResult>} npcAct
 * @property {(e: Extract<NPC.NpcAction, { action: 'do' }>) => Promise<void>} npcActDo
 * @property {(npc: NPC.NPC,  e: { point: Geomorph.PointWithMeta; fadeOutMs?: number; suppressThrow?: boolean }) => Promise<void>} offMeshDoMeta
 * Started off-mesh and clicked point
 * @property {(npc: NPC.NPC, e: { point: Geomorph.PointWithMeta; fadeOutMs?: number; suppressThrow?: boolean }) => Promise<void>} onMeshDoMeta
 * Started on-mesh and clicked point
 * @property {NPC.OnTtyLink} onTtyLink
 * @property {(e: { zoom?: number; point?: Geom.VectJson; ms: number; easing?: string }) => Promise<'cancelled' | 'completed'>} panZoomTo
 * @property {(npcKey: string) => void} removeNpc
 * @property {(el: null | HTMLDivElement) => void} rootRef
 * @property {(npcKey: string | null) => void} setPlayerKey
 * @property {(npcKey: string) => null | { gmId: number; roomId: number }} setRoomByNpc
 * @property {(e: { npcKey: string; npcClassKey?: NPC.NpcClassKey; point: Geomorph.PointWithMeta; angle?: number; requireNav?: boolean }) => Promise<void>} spawn
 * @property {import('../service/npc')} service
 * @property {(opts: ToggleLocalDecorOpts) => void} updateLocalDecor
 * @property {(e: { npcKey: string; process: import('../sh/session.store').ProcessMeta }) => import('rxjs').Subscription} trackNpc
 * @property {(e: { npcKey: string; throwOnCancel?: boolean } & NPC.GlobalNavPath) => Promise<void>} walkNpc
 * @property {(line: string, ttyCtxts?: NPC.SessionTtyCtxt[]) => Promise<void>} writeToTtys
 */

/**
 * @typedef ToggleLocalDecorOpts
 * @property {Graph.GmRoomId[]} [added]
 * @property {Graph.GmRoomId[]} [removed]
 */

/**
 * @typedef NpcActResult
 * @type {void | number | NPC.NPC | NPC.DecorDef | NPC.DecorDef[] | import("../sh/io").DataChunk<NPC.NpcConfigOpts>}
 */

/**
 * e.g. load walk spritesheet before walking
 */
const PrefetchSpritesheets = React.memo(() => {
  return (
    <div
      className="prefetch-spritesheets"
      style={{ display: 'none' }}
    >
      {Object.values(npcsMeta).map((meta) =>
        Object.values(meta.parsed.animLookup)
          .filter(({ frameCount }) => frameCount > 1)
          .map(({ animName, pathPng, pathWebp }) =>
            <img
              key={`${animName}@${meta.classKey}`}
              src={supportsWebp ? pathWebp : pathPng}
            />
          )
      )}
    </div>
  );
});
