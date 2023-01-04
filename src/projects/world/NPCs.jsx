import React from "react";
import { css, cx } from "@emotion/css";
import { merge, of, Subject, firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";

import { Vect } from "../geom";
import { ansiColor, stripAnsi } from "../sh/util";
import { dataChunk, proxyKey } from "../sh/io";
import { deepClone, keys, testNever, visibleUnicodeLength } from "../service/generic";
import { geom } from "../service/geom";
import * as npcService from "../service/npc";
import { cssName } from "../service/const";
import { getNumericCssVar } from "../service/dom";
import { npcJson, defaultNpcInteractRadius } from "../service/npc-json";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useGeomorphsNav from "../geomorph/use-geomorphs-nav";
import useSessionStore from "../sh/session.store";
import NPC from "./NPC";
import Decor from "./Decor";

/** @param {Props} props */
export default function NPCs(props) {

  const {api} = props;
  const update = useUpdate();

  const nav = useGeomorphsNav(api.gmGraph, props.disabled);

  const state = useStateRef(/** @type {() => State} */ () => ({
    decor: {},
    events: new Subject,

    npcKeys: [],
    npc: {},

    playerKey: /** @type {null | string} */ (null),
    rootEl: /** @type {HTMLDivElement} */ ({}),
    decorEl: /** @type {HTMLDivElement} */ ({}),
    ready: true,
    session: {},

    config: /** @type {Required<NPC.NpcConfigOpts>} */ (new Proxy(({
      omnipresent: /** @type {boolean} */ (false),
    }), {
      /** @param {keyof NPC.NpcConfigOpts | typeof proxyKey} key */
      get(ctxt, key) {
        const rootStyle = state.rootEl.style;
        const debugStyle = api.debug.rootEl.style;
        switch (key) {
          case 'canClickArrows': return debugStyle.getPropertyValue(cssName.debugDoorArrowPtrEvts) === 'none' ? false : true;
          case 'debug': return rootStyle.getPropertyValue(cssName.npcsDebugDisplay) === 'none' ? false : true;
          case 'gmOutlines': return debugStyle.getPropertyValue(cssName.debugGeomorphOutlineDisplay) === 'none' ? false : true;
          case 'interactRadius': return parseInt(rootStyle.getPropertyValue(cssName.npcsInteractRadius));
          case 'highlightWindows': return debugStyle.getPropertyValue(cssName.debugHighlightWindows) === 'none' ? false : true;
          case 'localNav': return debugStyle.getPropertyValue(cssName.debugRoomNavDisplay) === 'none' ? false : true;
          case 'localOutline': return debugStyle.getPropertyValue(cssName.debugRoomOutlineDisplay) === 'none' ? false : true;
          case 'omnipresent': return !!ctxt.omnipresent;
          case 'showIds': return debugStyle.getPropertyValue(cssName.debugShowIds) === 'none' ? false : true;
          case 'showLabels': return debugStyle.getPropertyValue(cssName.debugShowLabels) === 'none' ? false : true;
          case 'configKey':
          case 'decorKey':
          case 'npcKey':
            return undefined;
          case proxyKey: return true;
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
          case 'gmOutlines': debugStyle.setProperty(cssName.debugGeomorphOutlineDisplay, value ? 'initial' : 'none'); break;
          case 'highlightWindows': debugStyle.setProperty(cssName.debugHighlightWindows, value ? 'initial' : 'none'); break;
          case 'interactRadius': rootStyle.setProperty(cssName.npcsInteractRadius, `${value}px`); break;
          case 'localNav': debugStyle.setProperty(cssName.debugRoomNavDisplay, value ? 'initial' : 'none'); break;
          case 'localOutline': debugStyle.setProperty(cssName.debugRoomOutlineDisplay, value ? 'initial' : 'none'); break;
          case 'omnipresent': ctxt.omnipresent = !!value; break;
          case 'showIds': debugStyle.setProperty(cssName.debugShowIds, value ? 'initial' : 'none'); break;
          case 'showLabels': debugStyle.setProperty(cssName.debugShowLabels, value ? 'initial' : 'none'); break;
          case 'configKey':
          case 'decorKey':
          case 'npcKey':
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
          'showLabels',
        ];
      },
      getOwnPropertyDescriptor() {
        return { enumerable: true, configurable: true };
      }
    })),

    addTtyLineCtxts(sessionKey, lineText, ctxts) {
      // We strip ANSI colour codes for string comparison
      state.session[sessionKey].tty[stripAnsi(lineText)] = ctxts.map(x =>
        ({ ...x, lineText: stripAnsi(lineText), linkText: stripAnsi(x.linkText) })
      );
    },
    // 🚧 This should only run sporadically
    cleanSessionCtxts() {
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
    getGlobalNavPath(src, dst) {
      const {gms} = api.gmGraph
      const srcGmId = gms.findIndex(x => x.gridRect.contains(src));
      const dstGmId = gms.findIndex(x => x.gridRect.contains(dst));

      if (srcGmId === -1 || dstGmId === -1) {
        throw Error(`getGlobalNavPath: src/dst must be inside some geomorph's aabb`)
      } else if (srcGmId === dstGmId) {
        const localNavPath = state.getLocalNavPath(srcGmId, src, dst);
        console.log('localNavPath (single)', localNavPath);
        return {
          key: 'global-nav',
          fullPath: localNavPath.fullPath.slice(),
          navMetas: localNavPath.navMetas.map(x => ({ ...x, gmId: localNavPath.gmId })),
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

        for (let k = 0; k < gmEdges.length + 1; k++) {
          const localNavPath = k === 0
            // Initial
            ? state.getLocalNavPath(srcGmId, src, gmEdges[0].srcDoorEntry)
            : k < gmEdges.length
              // Intermediate
              ? state.getLocalNavPath(gmEdges[k - 1].dstGmId, gmEdges[k - 1].dstDoorEntry, gmEdges[k].srcDoorEntry)
              // Final
              : state.getLocalNavPath(dstGmId, gmEdges[k - 1].dstDoorEntry, dst);

          console.log('localNavPath', k, localNavPath);

          const gmEdge = gmEdges[k];
          
          if (k === 0 && localNavPath.doorIds[0] >= 0) {
            // Started in hull door, so ignore `localNavPath`
            fullPath.push(Vect.from(src));
          } else if (k === gmEdges.length && localNavPath.doorIds[1] >= 0) {
            // Ended in hull door, so ignore `localNavPath`
            fullPath.push(Vect.from(dst));
          } else {
            const indexOffset = fullPath.length;
            fullPath.push(...localNavPath.fullPath);
            // Globalise local navMetas
            navMetas.push(
              ...localNavPath.navMetas.map(x => ({
                ...x,
                index: indexOffset + x.index,
                gmId: localNavPath.gmId,
              })),
            );
          }

          if (gmEdge) {
            const baseMeta = {
              gmId: gmEdge.srcGmId,
              doorId: gmEdge.srcDoorId,
              hullDoorId: gmEdge.srcHullDoorId,
              index: fullPath.length - 1,
              otherRoomId: null,
            };
            navMetas.push({ key: 'start-seg', index: fullPath.length - 1, gmId: gmEdge.srcGmId });
            navMetas.push({ key: 'pre-exit-room', willExitRoomId: gmEdge.srcRoomId, ...baseMeta });
            navMetas.push({ key: 'exit-room', exitedRoomId: gmEdge.srcRoomId, ...baseMeta });
          }
        }
        
        return {
          key: 'global-nav',
          fullPath,
          navMetas,
        };
      }
    },
    /**
     * Wraps floorGraphClass.findPath
     */
    getLocalNavPath(gmId, src, dst) {
      const gm = api.gmGraph.gms[gmId];
      const localSrc = gm.inverseMatrix.transformPoint(Vect.from(src));
      const localDst = gm.inverseMatrix.transformPoint(Vect.from(dst));
      const pf = nav.pfs[gmId];
      const result = pf.graph.findPath(localSrc, localDst);

      if (result) {
        return {
          key: 'local-nav',
          gmId,
          ...result,
          // Avoid geom.removePathReps because navMetas would have to be adjusted
          fullPath: result.fullPath.map(p => gm.matrix.transformPoint(Vect.from(p)).precision(3)),
        };
      } else {
        return { key: 'local-nav', gmId, fullPath: [], navMetas: [], doorIds: [-1, -1] };
      }
    },
    /**
     * Used by shell function `nav`.
     * Wraps `state.getGlobalNavPath`.
     */
    getNpcGlobalNav(e) {
      const npc = state.npc[e.npcKey];
      if (!npc) {
        throw Error(`npcKey "${e.npcKey}" does not exist`);
      } else if (!(Vect.isVectJson(e.point))) {
        throw Error(`invalid point: ${JSON.stringify(e.point)}`);
      } else if (!state.isPointLegal(e.point)) {
        throw Error(`outside navPoly: ${JSON.stringify(e.point)}`);
      }
      const result = state.getGlobalNavPath(npc.getPosition(), e.point);
      // Always show path
      const decorKey = `${e.npcKey}-navpath`;
      state.setDecor({ key: decorKey, type: 'path', path: result.fullPath });
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
    getPointTags(point) {
      const tags = /** @type {string[]} */ ([]);
      if (state.isPointLegal(point)) tags.push('nav');
      /**
       * TODO e.g. table, chair, door, npc etc.
       */
      return tags;
    },
    isPointLegal(p) {
      const gmId = api.gmGraph.gms.findIndex(x => x.gridRect.contains(p));
      if (gmId === -1) return false;
      const { navPoly, inverseMatrix } = api.gmGraph.gms[gmId];
      const localPoint = inverseMatrix.transformPoint(Vect.from(p));
      return navPoly.some(poly => poly.contains(localPoint));
    },
    async npcAct(e) {
      switch (e.action) {
        case 'add-decor': // add decor(s)
          return state.setDecor(...e.items);
        case 'decor': // get or add decor
          return 'decorKey' in e
            ? state.decor[e.decorKey]
            : state.setDecor(e);
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
        case 'get':
          return state.getNpc(e.npcKey);
        // 🚧 promise via animationend event?
        case 'look-at': {
          if (!Vect.isVectJson(e.point)) {
            throw Error(`invalid point: ${JSON.stringify(e.point)}`);
          }
          const npc = state.getNpc(e.npcKey);
          return npc.lookAt(e.point);
        }
        case 'pause':// Pause current animation
          await state.getNpc(e.npcKey).pause();
          break;
        case 'play':// Resume current animation
          await state.getNpc(e.npcKey).play();
          break;
        case 'rm':
        case 'remove':
          return state.removeNpc(e.npcKey);
        case 'remove-decor':
        case 'rm-decor':
          if (e.decorKey) {
            e.decorKey.split(' ').forEach(decorKey => delete state.decor[decorKey]);
          }
          if (e.items) {
            e.items.forEach(decorKey => delete state.decor[decorKey]);
          }
          if (e.regexStr) {
            const keyRegex = new RegExp(e.regexStr);
            Object.keys(state.decor).forEach(decorKey =>
              keyRegex.test(decorKey) && delete state.decor[decorKey]
            ); 
          }
          update();
          break;
        case 'set-player':
          state.events.next({ key: 'set-player', npcKey: e.npcKey??null });
          break;
        default:
          throw Error(testNever(e, { override: `unrecognised action: "${JSON.stringify(e)}"` }));
      }
    },
    onTtyLink(sessionKey, lineText, linkText, linkStartIndex) {
      // console.log('onTtyLink', { lineNumber, lineText, linkText, linkStartIndex });
      state.cleanSessionCtxts();
      const found = state.session[sessionKey]?.tty[lineText]?.find(x =>
        x.linkStartIndex === linkStartIndex
        && x.linkText === linkText
      );
      if (!found) {
        return;
      }
      console.info('onTtyLink found', found); // 🚧
      switch (found.key) {
        case 'room':
          const gm = api.gmGraph.gms[found.gmId];
          const point = gm.matrix.transformPoint(gm.point[found.roomId].default.clone());
          state.panZoomTo({ zoom: 2, ms: 2000, point });
          break;
        // 🚧 ...
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
      state.npcKeys = state.npcKeys.filter(x => x.key in state.npc);
      update();
      state.npcAct({ action: 'set-player', npcKey: undefined });
      // 🚧 inform relevant processes?
      
    },
    rootRef(el) {
      if (el) {
        state.rootEl = el;
        /**
         * We set CSS variables here, not in css`...` below.
         * - ts-styled-plugin error for ${cssName.foo}: ${bar};
         * - setting style avoids `getComputedStyle`
         */
        el.style.setProperty(cssName.npcsInteractRadius, `${defaultNpcInteractRadius}px`);
        el.style.setProperty(cssName.npcsDebugDisplay, 'none');
      }
    },
    service: npcService,
    setDecor(...decor) {
      for (const d of decor) {
        if (!d || !npcService.verifyDecor(d)) {
          throw Error(`invalid decor: ${JSON.stringify(d)}`);
        }
        if (state.decor[d.key]) {
          d.updatedAt = Date.now();
        }
        state.decor[d.key] = d;
        if (d.type === 'path') {// Handle clones
          delete d.origPath;
        }
      }
      update();
    },
    setRoomByNpc(npcKey) {
      const npc = state.getNpc(npcKey);
      const position = npc.getPosition();
      const found = api.gmGraph.findRoomContaining(position);
      if (found) {
        const doorId = api.gmGraph.gms[found.gmId].doors.findIndex(x => x.roomIds.includes(found.roomId));
        props.api.fov.setRoom(found.gmId, found.roomId, doorId);
        props.api.updateAll();
        return found
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
      } else if (!state.isPointLegal(e.point)) {
        throw Error(`cannot spawn outside navPoly: ${JSON.stringify(e.point)}`);
      } else if (state.npc[e.npcKey]?.anim.spriteSheet === 'walk') {
        throw Error(`cannot spawn whilst walking`)
      }
      state.npcKeys = state.npcKeys
        .filter(({ key }) => key !== e.npcKey)
        .concat({
          key: e.npcKey,
          epochMs: Date.now(),
          def: {
            npcKey: e.npcKey,
            npcJsonKey: 'first-npc', // 🚧 remove hard-coding
            position: e.point,
            angle: e.angle,
            speed: npcJson["first-npc"].speed,
            segs: npcJson["first-npc"].segs.map(deepClone),
          },
        });
      update();

      await firstValueFrom(state.events.pipe(
        filter(x => x.key === 'spawned-npc' && x.npcKey === e.npcKey)
      ));
    },
    updateLocalDecor(opts) {// 🚧 generic approach?

      /** @type {(gmId: number, roomId: number, decorId: number) => string} */
      const getUiPointDecorKey = (gmId, roomId, decorId) => `local-${decorId}-g${gmId}r${roomId}`;
      /** @param {string} decorKey */
      const decodeUiPointDecorKey = (decorKey) => {
        const [, decorId, gmId, roomId] = /** @type {string[]} */ (decorKey.match(/^local-(\d+)-g(\d+)r(\d+)$/));
        return { decorId: Number(decorId), gmId: Number(gmId), roomId: Number(roomId) };
      }

      /** @type {(tags?: string[]) => NPC.DecorPoint['onClick']} */
      function cbFactory(tags) {
        return (decor, { npcs }) => {
          if (decor.tags?.includes('label')) {
            /** Assume `[...tags, label, ...labelWords]` */
            const label = decor.tags.slice(decor.tags.findIndex(tag => tag === 'label') + 1).join(' ');
            const { decorId: _, gmId, roomId } = decodeUiPointDecorKey(decor.key);
            const gm = api.gmGraph.gms[gmId];
            const numDoors = gm.roomGraph.getAdjacentDoors(roomId).length;
            const line = `ℹ️  [${ansiColor.Blue}${label}${ansiColor.Reset}] with ${numDoors} door${numDoors > 1 ? 's' : ''}`;
            npcs.writeToTtys(line, [{
              lineText: line, 
              linkText: label,
              linkStartIndex: visibleUnicodeLength('ℹ️  ['),
              key: 'room', gmId, roomId,
            }]
          );
          } else {
            npcs.writeToTtys(`ℹ️  ${ansiColor.White}tags: ${JSON.stringify(tags??[])}${ansiColor.Reset}`);
          }
        }
      }

      for (const { gmId, roomId } of opts.added??[]) {
        const { ui: points } = api.gmGraph.gms[gmId].point[roomId];
        const decorKeys = points.map((_, decorId) => getUiPointDecorKey(gmId, roomId, decorId))
        state.npcAct({ action: "add-decor",
          items: Object.values(points).map(({ point, tags }, uiId) => ({
            key: decorKeys[uiId], type: "point", x: point.x, y: point.y, tags: tags?.slice(),
            onClick: cbFactory(tags),
          })),
        });
      }
      for (const { gmId, roomId } of opts.removed??[]) {
        const { ui: points } = api.gmGraph.gms[gmId].point[roomId];
        const decorKeys = points.map((_, decorId) => getUiPointDecorKey(gmId, roomId, decorId))
        state.npcAct({ action: "rm-decor", items: decorKeys });
      }
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
          
          if (// npc not moving
            (npc.anim.spriteSheet === 'idle' || npc.anim.spriteSheet === 'sit')
            // camera not animating
            && (panZoom.anims[0] === null || ['finished', 'idle'].includes(panZoom.anims[0].playState))
            // camera not close
            && panZoom.distanceTo(npcPosition) > 10
          ) {
            status = 'panzoom-to';
            console.warn('@', status);
            // Ignore Error('cancelled')
            try { await panZoom.panZoomTo(1.75, npcPosition, 2000); } catch {};
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
    async walkNpc(e) {
      const npc = state.getNpc(e.npcKey);
      if (!npcService.verifyGlobalNavPath(e)) {
        throw Error(`invalid global navpath: ${JSON.stringify(e)}`);
      }

      try {// Walk along a global navpath
        const globalNavPath = e;
        const allPoints = globalNavPath.fullPath;
        // console.log('global navMetas', globalNavPath.navMetas); // DEBUG
        await npc.followNavPath(allPoints, { globalNavMetas: globalNavPath.navMetas });

      } catch (err) {
        if (err instanceof Error && err.message === 'cancelled') {
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
  }), { deps: [nav, api] });
  
  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <div
      className={cx('npcs', rootCss)}
      ref={state.rootRef}
    >

      <Decor
        decor={state.decor}
        api={api}
      />

      {/** Prioritise walk animations, to avoid load on start walk */}
      {Object.keys(npcJson).map((key) => (
        <img
          key={key}
          src={`/assets/npc/${key}--${'walk'}.png`}
          style={{ display: 'none' }}
        />
      ))}

      {Object.values(state.npcKeys).map(({ key, epochMs, def }) => (
        <NPC // Respawn remounts
          key={`${key}@${epochMs}`}
          api={props.api}
          def={def}
          disabled={props.disabled}
        />
      ))}

    </div>
  );
}

const rootCss = css`
  /** For CSS variables, see state.rootRef */

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
 * @property {boolean} [disabled] 
 * @property {(api: State) => void} onLoad
 */

/**
 * @typedef State @type {object}
 * @property {Record<string, NPC.DecorDef>} decor
 * @property {import('rxjs').Subject<NPC.NPCsEvent>} events
 * @property {{ key: string; epochMs: number; def: import('./NPC').PropsDef }[]} npcKeys
 * These items cause `<NPC>`s to mount
 * @property {Record<string, NPC.NPC>} npc
 * These items are created as a result of an `<NPC>` mounting
 *
 * @property {null | string} playerKey
 * @property {boolean} ready
 * @property {HTMLElement} rootEl
 * @property {HTMLElement} decorEl
 * @property {{ [sessionKey: string]: NPC.SessionCtxt }} session
 * @property {Required<NPC.NpcConfigOpts>} config Proxy
 *
 * @property {(sessionKey: string, lineText: string, ctxts: NPC.SessionTtyCtxt[]) => void} addTtyLineCtxts
 * @property {() => void} cleanSessionCtxts
 * @property {(src: Geom.VectJson, dst: Geom.VectJson) => NPC.GlobalNavPath} getGlobalNavPath
 * @property {(gmId: number, src: Geom.VectJson, dst: Geom.VectJson) => NPC.LocalNavPath} getLocalNavPath
 * @property {(e: { npcKey: string; point: Geom.VectJson }) => NPC.GlobalNavPath} getNpcGlobalNav
 * @property {() => number} getNpcInteractRadius
 * @property {(npcKey: string) => NPC.NPC} getNpc
 * @property {(convexPoly: Geom.Poly) => NPC.NPC[]} getNpcsIntersecting
 * @property {() => null | NPC.NPC} getPlayer
 * @property {(point: Geom.VectJson) => string[]} getPointTags
 * @property {(p: Geom.VectJson) => boolean} isPointLegal
 * @property {(e: NPC.NpcAction) => Promise<void | number | NPC.NPC | NPC.DecorDef | import("../sh/io").DataChunk<NPC.NpcConfigOpts>>} npcAct
 * @property {NPC.OnTtyLink} onTtyLink
 * @property {(e: { zoom?: number; point?: Geom.VectJson; ms: number; easing?: string }) => Promise<'cancelled' | 'completed'>} panZoomTo
 * @property {(npcKey: string) => void} removeNpc
 * @property {(el: null | HTMLDivElement) => void} rootRef
 * @property {(...decor: NPC.DecorDef[]) => void} setDecor
 * @property {(npcKey: string) => null | { gmId: number; roomId: number }} setRoomByNpc
 * @property {(e: { npcKey: string; point: Geom.VectJson; angle: number }) => Promise<void>} spawn
 * @property {import('../service/npc')} service
 * @property {(opts: ToggleLocalDecorOpts) => void} updateLocalDecor
 * @property {(e: { npcKey: string; process: import('../sh/session.store').ProcessMeta }) => import('rxjs').Subscription} trackNpc
 * @property {(e: { npcKey: string } & NPC.GlobalNavPath) => Promise<void>} walkNpc
 * @property {(line: string, ttyCtxts?: NPC.SessionTtyCtxt[]) => Promise<void>} writeToTtys
 */

/**
 * @typedef ToggleLocalDecorOpts
 * @property {Graph.GmRoomId[]} [added]
 * @property {Graph.GmRoomId[]} [removed]
 */