import React from "react";
import { merge, of, Subject, firstValueFrom } from "rxjs";
import { filter, tap } from "rxjs/operators";

import { Vect } from "../geom";
import { dataChunk, proxyKey } from "../sh/io";
import { assertDefined, keys, mapValues, generateSelector, testNever, removeFirst } from "../service/generic";
import { baseTrackingZoom, baseTrackingZoomMobile, cssName, defaultNpcClassKey, defaultNpcInteractRadius } from "./const";
import { geom } from "../service/geom";
import { hasGmRoomId } from "../service/geomorph";
import { npcService } from "../service/npc";
import { isSmallViewport, detectReactDevToolQuery, getNumericCssVar } from "../service/dom";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { MemoizedNPC } from "./NPC";
import createNpc from "./create-npc";

import npcsMeta from './npcs-meta.json';

/** @param {Props} props */
export default function NPCs(props) {

  const { api, api: { gmGraph: { gms } } } = props;
  const update = useUpdate();

  const state = useStateRef(/** @type {() => State} */ () => ({
    events: new Subject,
    npc: {},

    playerKey: null,
    rootEl: /** @type {HTMLDivElement} */ ({}),
    ready: true,
    session: {},

    config: /** @type {Required<NPC.NpcConfigOpts>} */ (new Proxy(({
      logTags: /** @type {boolean} */ (false),
      omnipresent: /** @type {boolean} */ (false),
      scriptDoors: /** @type {boolean} */ (true),
      verbose: /** @type {boolean} */ (false),
    }), {
      /** @param {keyof NPC.NpcConfigOpts | typeof proxyKey | 'toJSON'} key */
      get(ctxt, key) {
        if (detectReactDevToolQuery(key)) {
          return ctxt[key];
        }
        const rootStyle = state.rootEl.style;
        const debugStyle = api.debug.rootEl.style;
        const decorStyle = api.decor.rootEl.style;
        switch (key) {
          case 'canClickArrows': return debugStyle.getPropertyValue(cssName.debugDoorArrowPtrEvts) === 'none' ? false : true;
          case 'debug': return rootStyle.getPropertyValue(cssName.npcsDebugDisplay) === 'none' ? false : true;
          case 'debugPlayer': return rootStyle.getPropertyValue(cssName.npcsDebugPlayerDisplay) === 'none' ? false : true;
          case 'gmOutlines': return debugStyle.getPropertyValue(cssName.debugGeomorphOutlineDisplay) === 'none' ? false : true;
          case 'interactRadius': return parseInt(rootStyle.getPropertyValue(cssName.npcsInteractRadius));
          case 'hideGms': return api.getRootEl().classList.contains('hide-gms');
          case 'highlightWindows': return debugStyle.getPropertyValue(cssName.debugHighlightWindows) === 'none' ? false : true;
          case 'localNav': return debugStyle.getPropertyValue(cssName.debugRoomNavDisplay) === 'none' ? false : true;
          case 'localOutline': return debugStyle.getPropertyValue(cssName.debugRoomOutlineDisplay) === 'none' ? false : true;
          case 'omnipresent':
          case 'logTags':
          case 'scriptDoors':
          case 'verbose':
            return ctxt[key];
          case 'showIds': return debugStyle.getPropertyValue(cssName.debugShowIds) === 'none' ? false : true;
          case 'showColliders': return decorStyle.getPropertyValue(cssName.decorCollidersDisplay) === 'none' ? false : true;

          // 🚧 better way
          case 'configKey':
          case 'decorKey':
          case 'extraParams':
          case 'lit':
          case 'mapAction':
          case 'npcKey':
          case 'point':
          case 'suppressThrow':
          case 'timeMs':
            return undefined;

          case proxyKey: return true;
          case 'toJSON': return () => '{}'; // 🚧
          default:
            throw testNever(key, { suffix: 'config.get' });
        }
      },
      /** @param {keyof NPC.NpcConfigOpts} key */
      set(ctxt, key, value) {
        const rootStyle = state.rootEl.style;
        const debugStyle = api.debug.rootEl.style;
        const decorStyle = api.decor.rootEl.style;
        switch (key) {
          case 'canClickArrows': debugStyle.setProperty(cssName.debugDoorArrowPtrEvts, value ? 'all' : 'none'); break;
          case 'debug': rootStyle.setProperty(cssName.npcsDebugDisplay, value ? 'initial' : 'none'); break;
          case 'debugPlayer': rootStyle.setProperty(cssName.npcsDebugPlayerDisplay, value ? 'initial' : 'none'); break;
          case 'gmOutlines': debugStyle.setProperty(cssName.debugGeomorphOutlineDisplay, value ? 'initial' : 'none'); break;
          case 'hideGms': api.getRootEl().classList[value ? 'add' : 'remove']('hide-gms'); break;
          case 'highlightWindows': debugStyle.setProperty(cssName.debugHighlightWindows, value ? 'initial' : 'none'); break;
          case 'interactRadius': rootStyle.setProperty(cssName.npcsInteractRadius, `${value}px`); break;
          case 'localNav': debugStyle.setProperty(cssName.debugRoomNavDisplay, value ? 'initial' : 'none'); break;
          case 'localOutline': debugStyle.setProperty(cssName.debugRoomOutlineDisplay, value ? 'initial' : 'none'); break;
          case 'logTags': ctxt.logTags = !!value; break;
          case 'omnipresent': ctxt.omnipresent = !!value; break;
          case 'scriptDoors': ctxt.scriptDoors = !!value; api.doors.update(); break;
          case 'verbose': ctxt.verbose = !!value; break;
          case 'showColliders': decorStyle.setProperty(cssName.decorCollidersDisplay, value ? 'initial' : 'none'); break;
          case 'showIds': debugStyle.setProperty(cssName.debugShowIds, value ? 'initial' : 'none'); break;

          case 'configKey':
          case 'decorKey':
          case 'extraParams':
          case 'lit':
          case 'mapAction':
          case 'npcKey':
          case 'point':
          case 'suppressThrow':
          case 'timeMs':
            break;
          default:
            testNever(key, { suffix: 'config.set' });
        }
        return true;
      },
      ownKeys() {
        return [...npcService.fromConfigBooleanKeys, 'interactRadius'];
      },
      getOwnPropertyDescriptor() {
        return { enumerable: true, configurable: true };
      },
    })),

    canSee(src, dst, maxDistance) {
      if (typeof maxDistance === 'number' && tempVect.copy(src).distanceTo(dst) > maxDistance) {
        return false;
      } else if (!hasGmRoomId(src.meta ??= {}) && Object.assign(src.meta, api.gmGraph.findRoomContaining(src, true)).roomId == null) {
        return false;
      } else if (!hasGmRoomId(dst.meta ??= {}) && Object.assign(dst.meta, api.gmGraph.findRoomContaining(dst, true)).roomId == null) {
        return false;
      }

      const srcRm = /** @type {Geomorph.GmRoomId} */ (src.meta);
      const dstRm = /** @type {Geomorph.GmRoomId} */ (dst.meta);
      const vantages = api.gmRoomGraph.getVantages(srcRm, dstRm, true);

      if (!vantages) {
        return false;
      } else if (vantages.key === 'same-room') {
        const [srcL, dstL] = [src, dst].map(gms[srcRm.gmId].toLocalCoords);
        return !geom.outlineIntersectsSeg(gms[srcRm.gmId].roomsWithDoors[srcRm.roomId], srcL, dstL);
      } else if (vantages.key === 'adj-room') {
        // Raycast from `src` and check intersection is one of the open doors
        let [srcL, dstL] = [src, dst].map(gms[srcRm.gmId].toLocalCoords);
        const result = gms[srcRm.gmId].rayIntersectsDoor(srcL, dstL, srcRm.roomId, vantages.gmDoorIds.map(x => x.doorId));
        if (result === null) return false;

        // Raycast from intersection to `dst`
        srcL = new Vect(srcL.x + (result.lambda + 0.01) * (dstL.x - srcL.x), srcL.y + (result.lambda + 0.01) * (dstL.y - srcL.y));
        if (dstRm.gmId !== srcRm.gmId) {
          [srcL, dstL] = [srcL, dstL].map(gms[srcRm.gmId].toWorldCoords).map(gms[dstRm.gmId].toLocalCoords);
        }
        return !geom.outlineIntersectsSeg(gms[dstRm.gmId].roomsWithDoors[dstRm.roomId], srcL, dstL);

      } else {// rel-room 🚧 technique below is sound?
        // Raycast from `src` and check intersection is one of the open doors
        const srcDrs = vantages.relation.map(x => x.src);
        let [srcL, dstL] = [src, dst].map(gms[srcRm.gmId].toLocalCoords);
        const result = gms[srcRm.gmId].rayIntersectsDoor(srcL, dstL, srcRm.roomId, srcDrs.map(x => x.doorId));
        if (result === null) return false;

        const { depDoors, dst: dstDr } = assertDefined(vantages.relation.find(x => x.src.doorId === result.doorId));
        
        // Check intermediate doors, assuming they all reside in dstRm's gm
        [srcL, dstL] = [src, dst].map(gms[dstRm.gmId].toLocalCoords);
        const failure = (depDoors ?? []).find(x =>
          !geom.getLineSegsIntersection(srcL, dstL, ...gms[x.gmId].doors[x.doorId].seg)
        );
        if (failure) return false;

        // Raycast from `dst` and check intersection is `dstDr`
        [srcL, dstL] = [src, dst].map(gms[dstRm.gmId].toLocalCoords);
        return !!gms[dstRm.gmId].rayIntersectsDoor(dstL, srcL, dstRm.roomId, [dstDr.doorId]);
      }
    },
    connectNpcToProcess(processApi, npcKey) {
      const npc = state.getNpc(npcKey); // Throws if non-existent
      const process = processApi.getProcess();

      process.cleanups.push(() => { npc.cancel().catch(_e => {}); });
      process.onSuspends.push(() => { npc.pause(false); return true; });
      process.onResumes.push(() => { npc.resume(false); return true; });

      // kill on remove-npc 🚧 one sub elsewhere
      const subscription = this.events.subscribe({ next(x) {
        if (x.key === 'removed-npc' && x.npcKey === npcKey) {
          processApi.kill(true); // must kill whole process group
          subscription.unsubscribe();
        }
      }});
      process.cleanups.push(() => subscription.unsubscribe());

      // handlePaused waits until resumed, throws on process killed
      async function handlePaused() {
        npc.forcePaused && await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
          const subscription = state.events.subscribe({ next(x) {
            if (x.key === 'npc-internal' && x.npcKey === npcKey && x.event === 'resumed') {
              resolve();
              subscription.unsubscribe();
            }
          }});
          process.cleanups.push(
            () => reject(processApi.getKillError()),
            () => subscription.unsubscribe()
          );
        }));
      }

      return new Proxy(npc, {
        /** @param {keyof typeof npc} key */
        get(target, key) {
          if (key === 'cancel' || key === 'do' || key === 'fadeSpawn' || key === 'lookAt' || key === 'walk') {
            /** @param {[any, any]} args */
            return async function(...args) { await handlePaused(); await target[key](...args); }
          } else {
            return target[key];
          }
        },
      })
    },
    connectSession(sessionKey, opts = {}) {
      const connected = state.session[sessionKey] ||= {
        key: sessionKey,
        receiveMsgs: true,
        panzoomPids: [],
      };
      if (typeof opts.panzoomPid === 'number') {
        connected.panzoomPids.push(opts.panzoomPid);
      }
    },
    disconnectSession(sessionKey, opts) {
      const connected = state.session[sessionKey];
      if (!connected) {
        return;
      } else if (!opts) {
        delete state.session[sessionKey];
      } else if (typeof opts.panzoomPid === 'number') {
        removeFirst(connected.panzoomPids, opts.panzoomPid);
      }
    },
    getGlobalNavPath(src, dst, opts) {
      const [srcGmId] = api.gmGraph.findGeomorphIdContaining(src);
      const [dstGmId] = api.gmGraph.findGeomorphIdContaining(dst);

      if (srcGmId === null || dstGmId === null) {
        throw Error(`getGlobalNavPath: src, dst must be inside some geomorph's aabb`)
      } else if (srcGmId === dstGmId) {
        const localNavPath = state.getLocalNavPath(srcGmId, src, dst, opts);
        console.info('localNavPath (single)', localNavPath);
        return {
          key: 'global-nav',
          path: localNavPath.path.slice(),
          edgeNodeIds: localNavPath.partition,
          navMetas: localNavPath.navMetas.map(x => ({ ...x, gmId: localNavPath.gmId })),
          gmRoomIds: mapValues(localNavPath.roomIds, (roomId) => ({ gmId: srcGmId, roomId })),
        };
      } else {
        // Compute global strategy i.e. edges in gmGraph
        // const gmEdges = api.gmGraph.findPathSimplistic(src, dst);
        const gmEdges = api.gmGraph.findPath(src, dst);
        if (!gmEdges) {
          throw Error(`getGlobalNavPath: gmGraph.findPath not found: ${JSON.stringify(src)} -> ${JSON.stringify(dst)}`);
        }
        // console.log('gmEdges', gmEdges); // DEBUG

        const path = /** @type {Geom.Vect[]} */ ([]);
        const edgeNodeIds = /** @type {number[][]} */ ([]);
        const navMetas = /** @type {NPC.GlobalNavMeta[]} */ ([]);
        const gmRoomIds = /** @type {NPC.GlobalNavPath['gmRoomIds']} */ ({});

        for (let k = 0; k < gmEdges.length + 1; k++) {
          const localNavPath = k === 0
            // Initial
            ? state.getLocalNavPath(srcGmId, src, gmEdges[0].srcDoorEntry, opts)
            : k < gmEdges.length
              // Intermediate
              ? state.getLocalNavPath(gmEdges[k - 1].dstGmId, gmEdges[k - 1].dstDoorEntry, gmEdges[k].srcDoorEntry, opts)
              // Final
              : state.getLocalNavPath(dstGmId, gmEdges[k - 1].dstDoorEntry, dst, opts);

          console.warn('localNavPath', k, localNavPath);

          const gmEdge = gmEdges[k];
          
          if (k === 0 && localNavPath.doorIds[0]?.hull) {
            // Started in hull door, and will end in same one,
            // so ignore `localNavPath`
            path.push(Vect.from(src));
            gmRoomIds[0] = { gmId: srcGmId, roomId: localNavPath.roomIds[0] };
            navMetas.push({ key: 'vertex', index: 0, gmId: srcGmId });
          } else if (k === gmEdges.length && localNavPath.doorIds[1]?.hull) {
            // Ended in hull door, and will start in same one,
            // so ignore `localNavPath`
            path.push(Vect.from(dst));
            edgeNodeIds.push(...localNavPath.partition); // Add singleton containing door nav nodes
            navMetas.push({ key: 'vertex', index: path.length - 1, gmId: dstGmId });
            // if end in door then gmRoom hasn't changed
          } else {
            const indexOffset = path.length;
            path.push(...localNavPath.path);
            edgeNodeIds.push(...localNavPath.partition);
            Object.entries(localNavPath.roomIds).forEach(([k, roomId]) => // we include `k === 0`
              gmRoomIds[Number(k) + indexOffset] = { gmId: localNavPath.gmId, roomId }
            );
            // Globalise local navMetas
            navMetas.push(...localNavPath.navMetas.map(meta => ({
              ...meta,
              index: indexOffset + meta.index,
              gmId: localNavPath.gmId,
            })));
          }

          if (gmEdge && navMetas.at(-2)?.key !== 'exit-room') {
            // Avoid dup exit-room if localNavPath did via partition [..., doorNavNodes].
            // It probably always should i.e. we should remove the push below.
            navMetas.push({
              key: 'exit-room',
              index: path.length - 1,
              gmId: gmEdge.srcGmId,
              exitedRoomId: gmEdge.srcRoomId,
              doorId: gmEdge.srcDoorId,
              hullDoorId: gmEdge.srcHullDoorId,
              otherRoomId: null,
            });
          }
        }
        
        return {
          key: 'global-nav',
          path,
          edgeNodeIds,
          navMetas,
          gmRoomIds,
        };
      }
    },
    /**
     * Wraps @see {gm.floorGraph.findPath}
     */
    getLocalNavPath(gmId, src, dst, opts) {
      const gm = gms[gmId];
      const localSrc = gm.inverseMatrix.transformPoint(Vect.from(src));
      const localDst = gm.inverseMatrix.transformPoint(Vect.from(dst));
      const gmDoors = api.doors.lookup[gmId];
      const result = gm.floorGraph.findPath(localSrc, localDst, { doorMeta: gmDoors, ...opts });

      if (result) {
        return {
          key: 'local-nav',
          gmId,
          ...result,
          // Avoid geom.removePathReps because navMetas would have to be adjusted
          path: result.path.map(p => gm.matrix.transformPoint(Vect.from(p)).precision(3)),
        };
      } else {
        throw Error(`getLocalNavPath: no path found: ${JSON.stringify(src)} --> ${JSON.stringify(dst)}`);
      }
    },
    getNpcInteractRadius() {
      return getNumericCssVar(state.rootEl, cssName.npcsInteractRadius);
    },
    getNpc(npcKey, processApi) {
      const npc = processApi
        ? state.connectNpcToProcess(processApi, npcKey)
        : state.npc[npcKey];
      if (!npc) {
        throw Error(`npc "${npcKey}" does not exist`);
      } else {
        return npc;
      }
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
    getCloseNpcs(npcKey, isWalking) {
      return Object.values(state.npc).filter(
        other => other.key !== npcKey && (
          (isWalking === undefined) || (other.isWalking() === isWalking)
        )
      );
    },
    getPlayer() {
      return state.playerKey ? state.getNpc(state.playerKey) : null;
    },
    getRandomRoomNavpoint(gmId, roomId) {
      const gm = gms[gmId];
      // const nodeIds = gm.navZone.roomNodeIds[roomId];
      const nodeIds = gm.floorGraph.strictRoomNodeIds[roomId];
      const nodeId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      const navNode = gm.floorGraph.navNodes[nodeId];
      return gm.matrix.transformPoint(Vect.from(navNode.centroid));
    },
    getRandomRoom(filterGeomorphMeta = _ => true, filterRoomMeta = _ => true) {
      const gmIds = gms.flatMap(({ meta }, gmId) => filterGeomorphMeta(meta, gmId) ? gmId : []);
      if (gmIds.length === 0)
        throw Error(`getRandomRoom: no gmId matches filter`);
      const gmId = gmIds[Math.floor(gmIds.length * Math.random())];
      const roomIds = gms[gmId].roomMetas.flatMap((meta, roomId) => filterRoomMeta(meta) ? roomId : []);
      if (roomIds.length === 0)
        throw Error(`getRandomRoom: no roomId matches filter`);
      return { gmId, roomId: roomIds[Math.floor(roomIds.length * Math.random())] };
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
    inFrustum(src, dst, srcRadians, fovRadians = Math.PI / 4) {
      // 🤔 optionally outset triangle outgoing edges by npc radius?
      const leftRayNormal = tempVect.set(-Math.sin(srcRadians - fovRadians), Math.cos(srcRadians - fovRadians));
      const rightRayNormal = tempVect2.set(-Math.sin(srcRadians + fovRadians), Math.cos(srcRadians + fovRadians));
      const candidate = tempVect3.set(dst.x - src.x, dst.y - src.y);
      return (
        candidate.dot(leftRayNormal) >= 0
        && candidate.dot(rightRayNormal) <= 0
      );
    },
    isPanZoomControlled() {
      return Object.values(state.session).some(x => x.panzoomPids.length);
    },
    isPointInNavmesh(p) {
      const [gmId] = api.gmGraph.findGeomorphIdContaining(p);
      if (gmId !== null) {
        const { navPoly, inverseMatrix } = gms[gmId];
        const localPoint = inverseMatrix.transformPoint(Vect.from(p));
        return navPoly.some(poly => poly.contains(localPoint));
      } else {
        return false;
      }
    },
    isPointNearClosedDoor(point, radius, gmRoomId) {
      const gm = gms[gmRoomId.gmId];
      const localPoint = gm.inverseMatrix.transformPoint({...point});
      const closeDoor = gm.roomGraph.getAdjacentDoors(gmRoomId.roomId).find(({ doorId }) => 
        !api.doors.lookup[gmRoomId.gmId][doorId].open &&
        // 🚧 check distance from line segment instead?
        geom.createOutset(gm.doors[doorId].poly, radius)[0].contains(localPoint)
      );
      return !!closeDoor;
    },
    isPointSpawnable(npcKey, npcClassKey = defaultNpcClassKey, point) {
      // Must not be close to another npc
      if (state.npc[npcKey]?.isPointBlocked(point)) {
        return false;
      }
      // Must be inside some room or doorway
      const result = api.gmGraph.findRoomContaining(point, true);
      if (!result) {
        return false;
      }
      // Must not be close to a closed door
      const npcRadius = npcsMeta[npcClassKey].radius;
      if (state.isPointNearClosedDoor(point, npcRadius, result)) {
        return false;
      }
      return true;
    },
    async npcAct(e, processApi) {
      switch (e.action) {
        case 'add-decor': // add decor(s)
          return api.decor.setDecor(...e.items);
        case 'decor': // get decor, list decors, or add decor
          return 'decorKey' in e
            ? api.decor.decor[e.decorKey] // get
            : 'key' in e // 🚧 verify decor?
              ? api.decor.setDecor(e) // add
              : Object.values(api.decor.decor) // list
        case 'config': // set multiple, toggle multiple booleans, get all
          if ('configKey' in e) {// toggle multiple booleans
            const configKeys = e.configKey.split(' ').filter(npcService.isConfigBooleanKey);
            configKeys.forEach(configKey => state.config[configKey] = !state.config[configKey]);
          } else if (Object.keys(e).length === 1) {// get all
            /**
             * We must wrap the proxy in a chunk to avoid errors arising
             * from various `await`s ("then" is not defined).
             */
            return dataChunk([state.config]);
          } else {
            const partialConfig = /** @type {NPC.NpcActionConfigPartial} */ (e);
            keys(partialConfig).forEach(key => // set multiple
              // 🚧 ensure correct type
              partialConfig[key] !== undefined && (/** @type {*} */ (state.config)[key] = partialConfig[key])
            );
          }
          break;
        case 'events': // handled earlier
          break;
        case 'get':
          if ('npcKey' in e) {
            const npc = state.getNpc(e.npcKey, processApi);
            return e.selector ? generateSelector(e.selector, e.extraArgs).call(npc, npc) : npc;
          } else {
            return Object.values(state.npc); // list
          }
        case 'light': {
          const result = api.gmGraph.findRoomContaining(e.point);
          if (result) {
            const next = e.lit === undefined ? !api.geomorphs.gmRoomLit[result.gmId][result.roomId] : !!e.lit;
            api.geomorphs.setRoomLit(result.gmId, result.roomId, next);
          }
          break;
        }
        case 'map': // view/hide world map
          return api.fov.mapAct(e.mapAction, e.timeMs);
        case 'rm':
        case 'remove':
          e.npcKey !== undefined && state.removeNpc(e.npcKey);
          e.npcKeys?.forEach(npcKey => state.removeNpc(npcKey));
          return;
        case 'remove-decor':
        case 'rm-decor':
          if (e.decorKey) {
            api.decor.removeDecor(e.decorKey.split(' '));
          }
          if (e.items) {
            api.decor.removeDecor(e.items);
          }
          if (e.regexStr) {
            const keyRegex = new RegExp(e.regexStr);
            api.decor.removeDecor(
              Object.keys(api.decor.decor).filter(decorKey => keyRegex.test(decorKey))
            );
          }
          api.decor.update();
          break;
        case 'set-player':
          state.setPlayerKey(e.npcKey ?? null);
          break;
        default:
          throw Error(testNever(e, { override: `unrecognised action: "${JSON.stringify(e)}"` }));
      }
    },
    async panZoomTo(e) {
      if (!e || (e.zoom && !Number.isFinite(e.zoom)) || (e.point && !Vect.isVectJson(e.point)) || (e.ms && !Number.isFinite(e.ms))) {
        throw Error(`expected format: { zoom?: number; point?: { x: number; y: number }; ms: number; easing?: string }`);
      }
      try {
        await api.panZoom.panZoomTo(e.zoom, e.point, e.ms, e.easing);
        return 'completed';
      } catch (e) {
        return 'cancelled';
      }
    },
    parseNavigable(input) {
      if (Vect.isVectJson(input)) {
        if (state.isPointInNavmesh(input)) return input;
        throw Error(`point outside navmesh: ${JSON.stringify(input)}`)
      } else if (input in state.npc) {
        const npc =  state.npc[input];
        const point = npc.getPosition();
        if (state.isPointInNavmesh(point)) {
          return point;
        }
        // Fallback to close navigable point e.g. when:
        // (a) npc intentionally outside mesh
        // (b) npc stopped at intermediate path point "just outside mesh"
        const result = api.gmGraph.getClosePoint(point, npc.gmRoomId ?? undefined);
        if (result) return result.point;
        throw Error(`npc ${input} lacks nearby navigable: ${
          JSON.stringify({ point, gmRoomId: npc.gmRoomId })
        }`)
      } else {
        throw Error(`expected point or npcKey: "${JSON.stringify(input)}"`);
      }
    },
    removeNpc(npcKey) {
      state.getNpc(npcKey); // Throw if n'exist pas
      delete state.npc[npcKey];
      if (state.playerKey === npcKey) {
        state.npcAct({ action: 'set-player', npcKey: undefined });
      }
      state.events.next({ key: 'removed-npc', npcKey });
      update();
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
    svc: npcService,
    setPlayerKey(npcKey) {
      if (npcKey === '') {
        throw Error(`npc key cannot be empty`);
      }

      if (state.playerKey) {
        // Remove prev player CSS class, sans render
        const prevPlayer = state.npc[state.playerKey]; // May not exist
        prevPlayer?.el.root.classList.remove('player');
        api.fov.forgetPrev(); // Clears fov.nearDoorIds
      }

      if (npcKey === null) {
        state.playerKey = null;
        state.events.next({ key: 'set-player', npcKey: null });
        return;
      }

      const player = state.getNpc(npcKey); // Must exist
      player.el.root.classList.add('player');
      state.playerKey = npcKey;

      // Adjust FOV
      api.fov.setRoomByNpc(state.playerKey);
      // Initialize fov.nearDoorIds
      api.fov.computeNearDoorIds();

      state.events.next({ key: 'set-player', npcKey });
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
        await spawned.cancel(true);
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
          npcClassKey,
          position: e.point,
          speed: npcsMeta[npcClassKey].speed,
        }, { api });
        state.npc[e.npcKey].doMeta = e.point.meta?.do ? e.point.meta : null;
      }

      await Promise.allSettled([
        firstValueFrom(state.events.pipe(filter(x => x.key === 'spawned-npc' && x.npcKey === e.npcKey))),
        update(),
      ]);
    },
    trackNpc(npcKey, processApi) {
      const npc = state.getNpc(npcKey); // throws if undefined
      const baseZoom = isSmallViewport() ? baseTrackingZoomMobile : baseTrackingZoom;
      
      /** @typedef {'no-track' | 'follow-walk' | 'panzoom-to'} TrackStatus */ 
      let status = /** @type {TrackStatus} */ ('no-track');
      /** @param {TrackStatus} next */
      function changeStatus(next) { status = next; console.warn(`@ ${status}`); }
      
      const subscription = merge(
        of({ key: /** @type {const} */ ('init-track') }),
        state.events,
        api.panZoom.events,
      ).pipe(
        tap(x => {
          if (x.key === 'npc-internal' && x.npcKey === npcKey) {
            x.event === 'cancelled' && api.panZoom.animationAction('cancel')
            || x.event === 'paused' && api.panZoom.animationAction('pause')
            || x.event === 'resumed' && api.panZoom.animationAction('play');
          }
          if (x.key === 'removed-npc' && x.npcKey === npcKey) {
            subscription.unsubscribe();
          }
        }),
        filter(x => (
          processApi.isRunning() && (
            x.key === 'init-track'
            || x.key === 'ui-idle'
            || x.key === 'resized-bounds'
            || x.key === 'cancelled-panzoom-to'
            || x.key === 'completed-panzoom-to'
            || (x.key === 'started-walking' && x.npcKey === npcKey)
            || (x.key === 'stopped-walking' && x.npcKey === npcKey)
            || (x.key === 'spawned-npc' && x.npcKey === npcKey)
            || (x.key === 'changed-speed' && x.npcKey === npcKey)
            || (x.key === 'resumed-track' && x.npcKey === npcKey)
          )
        )),
      ).subscribe({
        async next(msg) {
          // console.log('msg', msg);
          if (
            msg.key === 'started-walking'
            || msg.key === 'changed-speed'
            || msg.key === 'resumed-track'
          ) {
            changeStatus('follow-walk');
            const path = npc.getTargets().map(x => x.point);
            return await api.panZoom.followPath(path, {
              animScaleFactor: npc.getAnimScaleFactor() * (1 / npc.anim.updatedPlaybackRate),
            }).catch(e => void (state.config.verbose && processApi.info(`ignored: ${e?.message ?? e}`))); // ignore Error('cancelled')
          }

          if (!api.panZoom.isIdle()) {
            return changeStatus('no-track');
          }
          
          if (// npc/camera not moving/close?
            (npc.anim.spriteSheet !== 'walk')
            && (api.panZoom.anims[0] === null || ['finished', 'idle'].includes(api.panZoom.anims[0].playState))
            && api.panZoom.distanceTo(npc.getPosition()) > 10
          ) {
            changeStatus('panzoom-to');
            await api.panZoom.panZoomTo(baseZoom, npc.getPosition(), 2000).catch(_ => {});
            changeStatus('no-track');
          }
        },
      });

      return subscription;
    },
  }), { deps: [api] });
  
  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <div
      className="npcs"
      ref={state.rootRef}
    >
      {Object.values(state.npc).map(({ key, epochMs }) => (
        <MemoizedNPC
          key={key}
          api={props.api}
          npcKey={key}
          epochMs={epochMs} // To override memoization
        />
      ))}
    </div>
  );
}

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
 * @property {(src: Geomorph.PointMaybeMeta, dst: Geomorph.PointMaybeMeta, maxDistance?: number) => boolean} canSee
 * @property {(processApi: ProcessApi, npcKey: string) => NPC.NPC} connectNpcToProcess
 * @property {(sessionKey: string, opts?: { panzoomPid?: number }) => void} connectSession
 * @property {(sessionKey: string, opts?: { panzoomPid?: number }) => void} disconnectSession
 * @property {(src: Geom.VectJson, dst: Geom.VectJson, opts?: NPC.NavOpts) => NPC.GlobalNavPath} getGlobalNavPath
 * @property {(gmId: number, src: Geom.VectJson, dst: Geom.VectJson, opts?: NPC.NavOpts) => NPC.LocalNavPath} getLocalNavPath
 * @property {() => number} getNpcInteractRadius
 * @property {(npcKey: string, processApi?: ProcessApi) => NPC.NPC} getNpc throws if does not exist
 * @property {(convexPoly: Geom.Poly) => NPC.NPC[]} getNpcsIntersecting
 * @property {(npcKey: string, isWalking?: boolean) => NPC.NPC[]} getCloseNpcs
 * 🚧 actually restrict to close npcs
 * @property {() => NPC.NPC | null} getPlayer
 * @property {(gmId: number, roomId: number) => Geom.VectJson} getRandomRoomNavpoint
 * @property {(filterGeomorphMeta?: (meta: Geomorph.PointMeta, gmId: number) => boolean, filterRoomMeta?: (meta: Geomorph.PointMeta) => boolean) => Geomorph.GmRoomId} getRandomRoom
 * @property {(nearbyMeta?: Geomorph.PointMeta, dstMeta?: Geomorph.PointMeta) => boolean} handleBunkBedCollide Collide due to height/obscured?
 * @property {(src: Geom.VectJson, dst: Geom.VectJson, srcRadians: number, fovRadians?: number) => boolean} inFrustum
 * assume `0 ≤ fovRadians ≤ π/2` (default `π/4`)
 * @property {() => boolean} isPanZoomControlled
 * @property {(p: Geom.VectJson, radius: number, gmRoomId: Geomorph.GmRoomId) => boolean} isPointNearClosedDoor
 * Is the point near some door adjacent to specified room?
 * @property {(p: Geom.VectJson) => boolean} isPointInNavmesh
 * @property {(npcKey: string, npcClassKey: NPC.NpcClassKey | undefined, p: Geomorph.PointMaybeMeta) => boolean} isPointSpawnable
 * @property {(e: NPC.NpcAction, processApi?: ProcessApi) => Promise<NpcActResult>} npcAct
 * @property {(e: { zoom?: number; point?: Geom.VectJson; ms: number; easing?: string }) => Promise<'cancelled' | 'completed'>} panZoomTo Always resolves
 * @property {(input: string | Geom.VectJson) => Geom.VectJson} parseNavigable
 * @property {(npcKey: string) => void} removeNpc
 * @property {(el: null | HTMLDivElement) => void} rootRef
 * @property {(npcKey: string | null) => void} setPlayerKey
 * @property {(e: { npcKey: string; npcClassKey?: NPC.NpcClassKey; point: Geomorph.PointMaybeMeta; angle?: number; requireNav?: boolean }) => Promise<void>} spawn
 * @property {import('../service/npc').NpcServiceType} svc
 * @property {(npcKey: string, processApi: ProcessApi) => import('rxjs').Subscription} trackNpc
 */

/**
 * @typedef NpcActResult
 * @type {void | number | NPC.NPC | NPC.NPC[] | NPC.DecorDef | NPC.DecorDef[] | import("../sh/io").DataChunk<NPC.NpcConfigOpts>}
 */

/**
 * @typedef {import('../sh/cmd.service').CmdService['processApi']} ProcessApi
 */

const [tempVect, tempVect2, tempVect3] = [1, 2, 3].map(_ => new Vect);
