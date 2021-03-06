import React from "react";
import { css, cx } from "@emotion/css";
import { merge, of, Subject, firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";

import { Vect } from "../geom";
import { stripAnsi } from "../sh/util";
import { scrollback } from "../sh/io";
import { testNever } from "../service/generic";
import { geom } from "../service/geom";
import { verifyGlobalNavPath, verifyDecor } from "../service/npc";
import { cssName } from "../service/const";
import { getNumericCssVar } from "../service/dom";
import { defaultNpcInteractRadius, npcSpeed } from "./create-npc";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useGeomorphsNav from "../geomorph/use-geomorphs-nav";
import useSessionStore from "../sh/session.store";
import NPC, { PropsDef } from "./NPC";
import Decor from "./Decor";

/** @param {Props} props */
export default function NPCs(props) {

  const update = useUpdate();

  const nav = useGeomorphsNav(props.gmGraph, props.disabled);

  const state = useStateRef(/** @type {() => State} */ () => ({
    decor: {},
    events: new Subject,

    npcKeys: [],
    npc: {},

    playerKey: /** @type {null | string} */ (null),
    rootEl: /** @type {HTMLDivElement} */ ({}),
    ready: true,
    session: {},

    addTtyLineCtxts(sessionKey, lineNumber, ctxts) {
      // We strip ANSI colour codes for string comparison
      state.session[sessionKey].tty[lineNumber] = ctxts.map(x =>
        ({ ...x, lineText: stripAnsi(x.lineText), linkText: stripAnsi(x.linkText) })
      );
    },
    cleanSessionCtxts() {
      for (const sessionKey of Object.keys(state.session)) {
        const session = useSessionStore.api.getSession(sessionKey);
        if (session) {
          const { tty } = state.session[sessionKey];
          /**
           * Assuming xterm buffer no larger than 2 * scrollback,
           * this lineNumber (ignoring wraps) is no longer visible.
           */
          const lowerBound = Math.max(0, session.ttyShell.xterm.totalLinesOutput - 2 * scrollback);
          Object.values(tty).forEach(([{ lineNumber }]) =>
            lineNumber <= lowerBound && delete tty[lineNumber]
          );
        } else delete state.session[sessionKey];
      }
    },
    detectCollision(npcA, npcB) {
      if (!npcA.getWalkBounds().intersects(npcB.getWalkBounds())) {
        return null;
      }

      const [segA, segB] = [npcA.getLineSeg(), npcB.getLineSeg()];
      const [iA, iB] = [segA?.src || npcA.getPosition(), segB?.src || npcB.getPosition()];
      /** i_AB := iA - iB is actually vector from B to A */
      const iAB = iA.clone().sub(iB), distABSq = iAB.lengthSquared;
      /** Minimum non-colliding distance between npcs */
      const minDist = (npcA.getRadius() + npcB.getRadius()) * 0.9;

      const dpA = segA ? segA.tangent.dot(iAB) : NaN;
      const dpB = segB ? segB.tangent.dot(iAB) : NaN;
      if (dpA >= 0 || dpB <= 0) {// Npcs not moving towards each other
        return null;
      }
      if (distABSq <= minDist ** 2) {
        return { seconds: 0, distA: 0, distB: 0 };
      }

      if (segA && segB) {
        const dirDp = segA.tangent.dot(segB.tangent);
        const [speedA, speedB] = [npcA.getSpeed(), npcB.getSpeed()];
        /**
         * seg vs seg
         * 
         * Solving `a.t^2 + b.t + c ??? 0`,
         * - `a := speedA^2 + speedB^2 - 2.speedA.speedB.dirDp`
         * - `b := 2.(speedA.dpA - speedB.dpB)`
         * - `c := distABSq - minDist^2`
         * 
         * Solutions are
         * ```js
         * (-b ?? ???(b^2 - 4ac)) / 2a // i.e.
         * (-b ?? ???inSqrt) / 2a
         */
        const a = (speedA ** 2) + (speedB ** 2) - 2 * speedA * speedB * dirDp;
        const b = 2 * (speedA * dpA - speedB * dpB);
        const c = distABSq - (minDist ** 2);
        const inSqrt = (b ** 2) - (4 * a * c);

        let seconds = 0;
        if (
          inSqrt > 0 && (
            seconds = (-b - Math.sqrt(inSqrt)) / (2 * a)
          ) <= segA.src.distanceTo(segA.dst) / speedA
        ) {
          return { seconds, distA: seconds * speedA, distB: seconds * speedB };
        }

      } else if (segA || segB) {
        const dp = /** @type {number} */ (segA ? dpA : -dpB);
        const speed = segA ? npcA.getSpeed() : npcB.getSpeed();
        const seg = /** @type {NPC.NpcLineSeg} */ (segA || segB);
        /**
         * seg vs static
         * 
         * Solving `a.t^2 + b.t + c ??? 0`,
         * - `a := speed^2`
         * - `b := 2.speed.dp`
         * - `c := distABSq - minDist^2`
         * 
         * Solutions are
         * ```js
         * (-b ?? ???(b^2 - 4ac)) / 2a // i.e.
         * (-b ?? 2.speed.???inSqrt) / 2a
         * ```
         */
        const inSqrt = (dp ** 2) - distABSq + (minDist ** 2);
        let seconds = 0;
        if (// Real-valued solution(s) exist and occur during line seg
          inSqrt > 0 && (
            seconds = (-dp - Math.sqrt(inSqrt)) * (1 / speed)
          ) <= seg.src.distanceTo(seg.dst) / speed
        ) {
          const distA = seconds * speed;
          return { seconds, distA, distB: distA };
        }
      } else {
        // Either static non-intersecting, or moving away from each other
      }
      return null;
    },

    getGlobalNavPath(src, dst) {
      const {gms} = props.gmGraph
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
        const gmEdges = props.gmGraph.findPath(src, dst);
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
      const gm = props.gmGraph.gms[gmId];
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
      state.setDecor(e.npcKey, { key: `${e.npcKey}-navpath`, type: 'path', path: result.fullPath });
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
      const gmId = props.gmGraph.gms.findIndex(x => x.gridRect.contains(p));
      if (gmId === -1) return false;
      const { navPoly, inverseMatrix } = props.gmGraph.gms[gmId];
      const localPoint = inverseMatrix.transformPoint(Vect.from(p));
      return navPoly.some(poly => poly.contains(localPoint));
    },
    async npcAct(e) {
      switch (e.action) {
        case 'add-decor':
          state.setDecor(e.key, e);
          break;
        case 'cancel':// Cancel current animation
          await state.getNpc(e.npcKey).cancel();
          break;
        case 'config':
          if (typeof e.interactRadius === 'number') {
            state.rootEl.style.setProperty(cssName.npcsInteractRadius, `${e.interactRadius}px`);
          }
          if (e.debug !== undefined) {
            state.rootEl.style.setProperty(cssName.npcsDebugDisplay, e.debug ? 'initial' : 'none');
          }
          break;
        case 'get':
          return state.getNpc(e.npcKey);
        case 'look-at': {
          const npc = state.getNpc(e.npcKey);
          if (!Vect.isVectJson(e.point)) {
            throw Error(`invalid point: ${JSON.stringify(e.point)}`);
          }
          await npc.lookAt(e.point);
          break;
        }
        case 'pause':// Pause current animation
          await state.getNpc(e.npcKey).pause();
          break;
        case 'play':// Resume current animation
          await state.getNpc(e.npcKey).play();
          break;
        case 'remove-decor':
        case 'rm-decor':
          state.setDecor(e.decorKey, null);
          break;
        case 'set-player':
          state.events.next({ key: 'set-player', npcKey: e.npcKey??null });
          break;
        default:
          throw Error(testNever(e, `unrecognised action: "${JSON.stringify(e)}"`));
      }
    },
    onTtyLink(sessionKey, lineNumber, lineText, linkText, linkStartIndex) {
      // console.log('onTtyLink', { lineNumber, lineText, linkText, linkStartIndex });
      state.cleanSessionCtxts();
      const found = state.session[sessionKey]?.tty[lineNumber]?.find(x =>
        x.lineText === lineText
        && x.linkStartIndex === linkStartIndex
        && x.linkText === linkText
      );
      if (!found) {
        return;
      }
      console.info('onTtyLink found', found); // DEBUG ????
      switch (found.key) {
        case 'room':
          const gm = props.gmGraph.gms[found.gmId];
          const point = gm.matrix.transformPoint(gm.point[found.roomId].default.clone());
          state.panZoomTo({ zoom: 2, ms: 2000, point });
          break;
        /**
         * ...
         */
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
    rootRef(el) {
      if (el) {
        state.rootEl = el;
        el.style.setProperty(cssName.npcsInteractRadius, `${defaultNpcInteractRadius}px`);
        el.style.setProperty(cssName.npcsDebugDisplay, 'none');
      }
    },
    setDecor(decorKey, decor) {
      if (decor) {
        if (!verifyDecor(decor)) {
          throw Error('invalid decor');
        }
        state.decor[decorKey] = decor;
      } else {
        delete state.decor[decorKey];
      }
      update();
    },
    setRoomByNpc(npcKey) {
      const npc = state.getNpc(npcKey);
      const position = npc.getPosition();
      const found = props.gmGraph.findRoomContaining(position);
      if (found) {
        props.api.fov.setRoom(found.gmId, found.roomId);
        props.api.updateAll();
      } else {// TODO error in terminal?
        console.error(`set-player ${npcKey}: no room contains ${JSON.stringify(position)}`)
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
            position: e.point,
            angle: e.angle,
            speed: npcSpeed,
          },
        });
      update();

      await firstValueFrom(state.events.pipe(
        filter(x => x.key === 'spawned-npc' && x.npcKey === e.npcKey)
      ));
    },
    trackNpc(opts) {
      const { npcKey, process } = opts;
      if (!state.npc[npcKey]) {
        throw Error(`npc "${npcKey}" does not exist`);
      }

      let status = /** @type {'no-track' | 'follow-walk' | 'panzoom-to'} */ ('no-track');
      const { panZoom } = props.api

      const subscription = merge(
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
          // console.log(msg); // DEBUG
          if (!panZoom.isIdle() && msg.key !== 'started-walking') {
            status = 'no-track';
            console.warn('@', status);
            return;
          }

          const npc = state.npc[npcKey];
          const npcPosition = npc.getPosition();
          
          if (// Only when: npc idle, camera not animating, camera not close
            npc.anim.spriteSheet === 'idle'
            && (panZoom.anims[0] === null || panZoom.anims[0].playState === 'finished')
            && panZoom.distanceTo(npcPosition) > 10
          ) {
            status = 'panzoom-to';
            console.warn('@', status);
            // Ignore Error('cancelled')
            try { await panZoom.panZoomTo(1.5, npcPosition, 2000) } catch {}
            status = 'no-track';
          }

          if (msg.key === 'started-walking') {
            status = 'follow-walk';
            console.warn('@', status);
            try {
              const path = npc.getTargets().map(x => x.point);
              await panZoom.followPath(path, { animScaleFactor: npc.getAnimScaleFactor() });
            } catch {} // Ignore Error('cancelled')
          }
        },
      });
      
      return subscription;
    },
    async walkNpc(e) {
      const npc = state.getNpc(e.npcKey);
      if (!verifyGlobalNavPath(e)) {
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
  }), { deps: [nav, props.api] });
  
  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <div
      className={cx('npcs', rootCss)}
      ref={state.rootRef}
    >

      {Object.entries(state.decor).map(([key, item]) =>
        <Decor key={key} item={item} />
      )}

      {Object.values(state.npcKeys).map(({ key, epochMs, def }) => (
        <NPC // Respawn remounts
          key={`${key}@${epochMs}`}
          api={props.api}
          def={def}
          disabled={props.disabled}
        />
      ))}
      {/* {Object.values(state.npc).map(npc => (
        <NPC // Respawn remounts
          key={`${npc.key}@${npc.epochMs}`}
          npc={npc}
        />
      ))} */}
    </div>
  );
}

const rootCss = css`
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

    .debug-circle {
      fill: #ff000035;
    }
  }
`;

/**
 * @typedef Props @type {object}
 * @property {import('../world/World').State} api
 * @property {boolean} [disabled] 
 * @property {Graph.GmGraph} gmGraph
 * @property {(api: State) => void} onLoad
 */

/**
 * @typedef State @type {object}
 * @property {Record<string, NPC.DecorDef>} decor
 * @property {import('rxjs').Subject<NPC.NPCsEvent>} events
 *
 * @property {{ key: string; epochMs: number; def: PropsDef }[]} npcKeys
 * These items cause `<NPC>`s to mount
 * @property {Record<string, NPC.NPC>} npc
 * These items are created as a result of an `<NPC>` mounting
 *
 * @property {null | string} playerKey
 * @property {boolean} ready
 * @property {HTMLElement} rootEl
 * @property {{ [sessionKey: string]: NPC.SessionCtxt }} session
 *
 * @property {(sessionKey: string, lineNumber: number, ctxts: NPC.SessionTtyCtxt[]) => void} addTtyLineCtxts
 * @property {() => void} cleanSessionCtxts
 * @property {(npcA: NPC.NPC, npcB: NPC.NPC) => null | NPC.NpcCollision} detectCollision
 * @property {(src: Geom.VectJson, dst: Geom.VectJson) => NPC.GlobalNavPath} getGlobalNavPath
 * @property {(gmId: number, src: Geom.VectJson, dst: Geom.VectJson) => NPC.LocalNavPath} getLocalNavPath
 * @property {(e: { npcKey: string; point: Geom.VectJson }) => NPC.GlobalNavPath} getNpcGlobalNav
 * @property {() => number} getNpcInteractRadius
 * @property {(npcKey: string) => NPC.NPC} getNpc
 * @property {(convexPoly: Geom.Poly) => NPC.NPC[]} getNpcsIntersecting
 * @property {() => null | NPC.NPC} getPlayer
 * @property {(point: Geom.VectJson) => string[]} getPointTags
 * @property {(p: Geom.VectJson) => boolean} isPointLegal
 * @property {(e: NPC.NpcAction) => Promise<undefined | NPC.NPC>} npcAct
 * @property {NPC.OnTtyLink} onTtyLink
 * @property {(e: { zoom?: number; point?: Geom.VectJson; ms: number; easing?: string }) => Promise<'cancelled' | 'completed'>} panZoomTo
 * @property {(el: null | HTMLDivElement) => void} rootRef
 * @property {(decorKey: string, decor: null | NPC.DecorDef) => void} setDecor
 * @property {(npcKey: string) => void} setRoomByNpc
 * @property {(e: { npcKey: string; point: Geom.VectJson; angle: number }) => Promise<void>} spawn
 * @property {(e: { npcKey: string; process: import('../sh/session.store').ProcessMeta }) => import('rxjs').Subscription} trackNpc
 * @property {(e: { npcKey: string } & NPC.GlobalNavPath) => Promise<void>} walkNpc
 */
