import React from "react";
import { merge, of, Subject, firstValueFrom } from "rxjs";
import { filter, tap } from "rxjs/operators";

import { Graphics } from "@pixi/graphics";
import { Assets } from "@pixi/assets";
import { RenderTexture } from "@pixi/core";
import { ParticleContainer } from "@pixi/react";

import { Vect } from "../geom";
import { dataChunk, proxyKey } from "../sh/io";
import { assertDefined, keys, mapValues, generateSelector, testNever, removeFirst } from "../service/generic";
import { geom } from "../service/geom";
import { decorToRef, hasGmRoomId } from "../service/geomorph";
import { detectReactDevToolQuery } from "../service/dom";
import { defaultNpcSpeed, defaultNpcClassKey, defaultNpcInteractRadius } from "./const";

import { useQueryOnce } from "../hooks/use-query-utils";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

import createNpc from "./create-npc";
import spineMeta from 'static/assets/npc/top_down_man_base/spine-meta.json';

/** @param {Props} props */
export default function NPCs(props) {

  const { api, api: { gmGraph: { gms } } } = props;
  const update = useUpdate();

  const state = useStateRef(/** @type {() => State} */ () => ({
    srcTex: /** @type {*} */ ({}),
    tex: RenderTexture.create({ width: spineMeta.packedWidth, height: spineMeta.packedHeight }),
    pc: /** @type {*} */ ({}),

    events: new Subject,
    npc: {},
    playerKey: null,
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
        switch (key) {
          case 'canClickArrows': return api.debug.opts.canClickArrows;
          case 'debug': return api.debug.opts.debug;
          case 'debugHit': return api.debug.opts.debugHit;
          case 'debugPlayer': return api.debug.opts.debugPlayer;
          case 'gmOutlines': return api.debug.opts.gmOutlines;
          case 'interactRadius': return api.debug.opts.interactRadius;
          case 'hideGms':
            // return api.getRootEl().classList.contains('hide-gms');
            return;
          case 'highlightWindows': return api.debug.opts.windowOutlines;
          case 'localColliders': return api.debug.opts.roomColliders;
          case 'localNav': return api.debug.opts.roomNav;
          case 'localOutline': return api.debug.opts.roomOutline;
          case 'colliders': return api.decor.showColliders;
          case 'omnipresent':
          case 'logTags':
          case 'scriptDoors':
          case 'verbose':
            return ctxt[key];

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
        switch (key) {
          case 'canClickArrows':
            api.debug.opts.canClickArrows = !!value;
            api.fov.gmId >= 0 && api.debug.updateDebugRoom();
            api.debug.render();
            break;
          case 'debug':
            api.debug.opts.debug = !!value;
            // 🚧 update npcs
            break;
          case 'debugHit':
            api.debug.opts.debugHit = !!value;
            api.debug.render();
            break;
          case 'debugPlayer':
            api.debug.opts.debugPlayer = !!value;
            // 🚧 update npcs
            break;
          case 'gmOutlines':
            api.debug.opts.gmOutlines = !!value;
            api.fov.renderAll();
            break;
          case 'hideGms':
            // api.getRootEl().classList[value ? 'add' : 'remove']('hide-gms');
            break;
          case 'highlightWindows':
            api.debug.opts.windowOutlines = !!value;
            api.debug.render();
            break;
          case 'interactRadius':
            api.debug.opts.debug = !!value;
            // 🚧 update npcs
            break;
          case 'localColliders':
            api.debug.opts.roomColliders = !!value;
            api.debug.render();
            break;
          case 'localNav':
            api.debug.opts.roomNav = !!value;
            api.debug.render();
            break;
          case 'localOutline':
            api.debug.opts.roomOutline = !!value;
            api.debug.render();
            break;
          case 'logTags': ctxt.logTags = !!value; break;
          case 'omnipresent': ctxt.omnipresent = !!value; break;
          case 'scriptDoors':
            ctxt.scriptDoors = !!value; // 🚧 remove?
            // api.doors.update();
            break;
          case 'verbose': ctxt.verbose = !!value; break;
          case 'colliders':
            api.decor.showColliders = !!value;
            api.decor.renderAll();
            break;

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
        return [...api.lib.fromConfigBooleanKeys, 'interactRadius'];
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

      process.cleanups.push((SIGINT) => {
        npc.cancel(SIGINT).catch(e => void (// Ctrl-C overrides forcePaused
          state.config.verbose && processApi.info(`ignored: ${e?.message ?? e}`)
        ));
      });
      process.onSuspends.push(() => { npc.pause(false); return true; });
      process.onResumes.push(() => { npc.resume(false); return true; });

      // kill on remove-npc
      // 🚧 create a single subscription elsewhere
      const subscription = this.events.subscribe({ next(x) {
        if (x.key === 'removed-npc' && x.npcKey === npcKey) {
          processApi.kill(true); // must kill whole process group
          subscription.unsubscribe();
        }
      }});
      process.cleanups.push(() => subscription.unsubscribe());

      // waits for a "forcePaused npc" to be resumed; throws on process killed
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
      const connected = state.session[sessionKey] ??= {
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
      if (opts?.endsNavigable) {
        if (!state.isPointInNavmesh(src)) {
          throw Error(`point (src) outside navmesh: ${JSON.stringify(src)}`)
        }
        if (!state.isPointInNavmesh(dst)) {
          throw Error(`point (dst) outside navmesh: ${JSON.stringify(dst)}`)
        }
      }

      if (srcGmId === null || dstGmId === null) {
        throw Error(`getGlobalNavPath: src, dst must be inside some geomorph's aabb`)
      } else if (srcGmId === dstGmId) {
        const localNavPath = state.getLocalNavPath(srcGmId, src, dst, opts);
        // console.info('localNavPath (single)', localNavPath);
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

          // console.warn('localNavPath', k, localNavPath);

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
    getGlobalTour(points, opts) {
      return api.lib.concatenateNavPaths(points.slice(1).map((point, i) =>
        api.npcs.getGlobalNavPath(points[i], point, { ...opts, centroidsFallback: true }),
      ));
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
    getNpcInteractRadius() {// 🚧 can vary
      return defaultNpcInteractRadius;
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
    // 🚧 needs clarity
    handleBunkBedCollide(nearbyMeta, dstMeta) {
      return (// Collide if at same height
        (nearbyMeta?.height === dstMeta?.height) ||
        (// Otherwise, collide if exactly one "do point" and obscured (?)
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
      if (state.npc[npcKey]?.isPointBlocked(point)) {
        return false; // Must not be close to another npc
      }
      const gmRoomId = api.gmGraph.findRoomContaining(point, true);
      if (!gmRoomId) {
        return false; // Must be inside some room or doorway
      }
      const npcRadius = spineMeta.npcRadius;
      if (state.isPointNearClosedDoor(point, npcRadius, gmRoomId)) {
        return false; // Must not be close to a closed door
      }
      return true;
    },
    async npcAct(e, processApi) {
      switch (e.action) {
        case 'add-decor': // add decor(s)
          return api.decor.addDecor(e.items);
        case 'decor': { // get decor, list decors, or add decor
          if ('decorKey' in e) return api.decor.decor[e.decorKey] // get
          else if ('key' in e) return api.decor.addDecor([e]); // add
          else return Object.values(api.decor.decor); // list
        }
        case 'cfg':
        case 'config': // set multiple, toggle multiple booleans, get all
          if ('configKey' in e) {// toggle multiple booleans
            const configKeys = e.configKey.split(' ').filter(api.lib.isConfigBooleanKey);
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
            const next = e.lit === undefined ? !api.geomorphs.isRoomLit[result.gmId][result.roomId] : !!e.lit;
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
          // api.decor.render();
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
        await api.panZoom.panZoomTo({ ms: e.ms, scale: e.zoom, point: e.point, easing: e.easing });
        return 'completed';
      } catch (e) {
        return 'cancelled';
      }
    },
    parseNavigable(input) {
      if (Vect.isVectJson(input)) {
        if (state.isPointInNavmesh(input)) return input;
        throw Error(`point outside navmesh: ${JSON.stringify(input)}`);
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
      const npc = state.getNpc(npcKey); // Throw if n'exist pas
      delete state.npc[npcKey];
      if (state.playerKey === npcKey) {
        state.npcAct({ action: 'set-player', npcKey: undefined });
      }
      state.pc.removeChild(...Object.values(npc.s));
      state.events.next({ key: 'removed-npc', npcKey });
      update();
    },
    setPlayerKey(npcKey) {
      if (npcKey === '') {
        throw Error(`npc key cannot be empty`);
      }
      if (state.playerKey) {
        api.fov.forgetPrev();
      }
      if (npcKey === null) {
        state.playerKey = null;
        state.events.next({ key: 'set-player', npcKey: null });
        return;
      }

      state.playerKey = npcKey;
      api.fov.setRoomByNpc(state.playerKey);
      state.events.next({ key: 'set-player', npcKey });
    },
    async spawn(e) {
      if (!(typeof e.npcKey === 'string' && e.npcKey.trim())) {
        throw Error(`invalid npc key: ${JSON.stringify(e.npcKey)}`);
      } else if (!(e.point && typeof e.point.x === 'number' && typeof e.point.y === 'number')) {
        throw Error(`invalid point: ${JSON.stringify(e.point)}`);
      } else if (e.requireNav && !state.isPointInNavmesh(e.point)) {
        throw Error(`cannot spawn outside navPoly: ${JSON.stringify(e.point)}`);
      } else if (e.npcClassKey && !api.lib.isNpcClassKey(e.npcClassKey)) {
        throw Error(`invalid npcClassKey: ${JSON.stringify(e.npcClassKey)}`);
      }

      if (!state.isPointSpawnable(e.npcKey, e.npcClassKey, e.point)) {
        throw new Error('cancelled');
      }

      let spawned = state.npc[e.npcKey];
      if (spawned) {// Respawn
        await spawned.cancel(true);
        spawned.epochMs = Date.now();
        spawned.def = {
          key: e.npcKey,
          angle: e.angle ?? spawned?.getAngle() ?? 0, // Previous angle fallback
          classKey: spawned.classKey,
          position: e.point,
          walkSpeed: defaultNpcSpeed,
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
        state.npc[e.npcKey] = spawned = createNpc({
          key: e.npcKey,
          angle: e.angle ?? 0,
          classKey: npcClassKey,
          position: e.point,
          walkSpeed: defaultNpcSpeed,
        }, api);
        spawned.doMeta = e.point.meta?.do ? e.point.meta : null;
        state.pc.addChild(...Object.values(spawned.s));
      }

      spawned.gmRoomId && api.decor.getDecorAtPoint(
        spawned.getPosition(), spawned.gmRoomId.gmId, spawned.gmRoomId.roomId
      ).forEach(decor =>
        api.npcs.events.next({ key: 'way-point', npcKey: spawned.key, meta: {
          key: 'decor-collide',
          type: 'exit',
          decor: decorToRef(decor),
          gmId: /** @type {Geomorph.GmRoomId} */ (spawned.gmRoomId).gmId,
          index: -1, // 🚧 clarify index -1
          length: 0,
        }})
      );

      spawned.initialize();
      spawned.startAnimation('idle');
      api.npcs.events.next({ key: 'spawned-npc', npcKey: spawned.key });

      spawned.gmRoomId && api.decor.getDecorAtPoint(
        spawned.getPosition(), spawned.gmRoomId.gmId, spawned.gmRoomId.roomId,
      ).forEach(decor =>
        api.npcs.events.next({ key: 'way-point', npcKey: spawned.key, meta: {
          key: 'decor-collide',
          type: 'enter',
          decor: decorToRef(decor),
          gmId: /** @type {Geomorph.GmRoomId} */ (spawned.gmRoomId).gmId,
          index: -1, // 🚧 clarify index -1
          length: 0,
        }})
      );
    },
    // 🚧 use pixi viewport, possibly complete rewrite?
    trackNpc(npcKey, processApi) {

      const npc = state.getNpc(npcKey);
      
      /** @typedef {'no-track' | 'follow-walk' | 'panzoom-to'} TrackStatus */ 
      let status = /** @type {TrackStatus} */ ('no-track');
      /** @param {TrackStatus} next */
      function changeStatus(next) { status = next; console.warn(`@ ${status}`); }
      
      async function panZoomTo() {
        changeStatus('panzoom-to');
        // 🚧 use pixi viewport
        // await api.panZoom.animationAction('cancelFollow');
        // await api.panZoom.panZoomTo({
        //   durationMs: 2000,
        //   scale: npc.everWalked() ? undefined : baseTrackingZoom,
        //   worldPoint: npc.getPosition(),
        // }).catch(e => void (state.config.verbose && processApi.info(`ignored: ${e.message ?? e}`)));
        changeStatus('no-track');
      }

      const subscription = merge(
        of({ key: /** @type {const} */ ('init-track') }),
        state.events,
        // 🚧 use pixi viewport
        // api.panZoom.events,
      ).pipe(
        tap(x => {
          if (x.key === 'npc-internal' && x.npcKey === npcKey) {
            // 🚧 use pixi viewport
            // 🤔 should cancelFollow too?
            // x.event === 'cancelled' && api.panZoom.animationAction('cancelPanZoom')
            // || x.event === 'paused' && api.panZoom.animationAction('pause')
            // || x.event === 'resumed' && api.panZoom.animationAction('play');
          }
          if (x.key === 'removed-npc' && x.npcKey === npcKey) {
            subscription.unsubscribe();
          }
        }),
        filter(x => (
          processApi.isRunning() &&
          !npc.isPaused() && (
            x.key === 'init-track'
            // 🚧 use pixi viewport
            // || x.key === 'ui-idle'
            // || x.key === 'resized-bounds'
            // || x.key === 'cancelled-panzoom-to'
            // || x.key === 'completed-panzoom-to'
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
          if (msg.key === 'stopped-walking') {
            await panZoomTo();
          } else if (
            msg.key === 'started-walking'
            || msg.key === 'changed-speed'
            || msg.key === 'resumed-track'
          ) {
            changeStatus('follow-walk');
            const path = npc.getTargets();
            // 🚧 use pixi viewport
            // await api.panZoom.followPath(path, {
            //   animScaleFactor: npc.getAnimScaleFactor() * (1 / npc.anim.updatedPlaybackRate),
            // }).catch(e => // ignore Error('cancelled')
            //   void (state.config.verbose && processApi.info(`ignored: ${e?.message ?? e}`))
            // );
        // 🚧 use pixi viewport
        //   } else if (!api.panZoom.isIdle()) {
        //     // User is manually pan/zooming
        //     changeStatus('no-track');
        //   } else if (
        //     npc.anim.spriteSheet !== 'walk'
        //     && api.panZoom.panzoomAnim === null
        //     && api.panZoom.distanceTo(npc.getPosition()) > 60
        //   ) {// npc not moving and camera not close
        //     await panZoomTo();
          }
        },
      });

      return subscription;
    },
  }), { deps: [api] });
  
  useQueryOnce('spritesheet',
    async function queryFn() {
      state.srcTex = await Assets.load(`/assets/npc/top_down_man_base/spine-render/spritesheet.webp`);
      api.renderInto((new Graphics)
        .beginTextureFill({ texture: state.srcTex })
        .drawRect(0, 0, state.tex.width, state.tex.height)
        .endFill(), state.tex);

      props.onLoad(state);
      return null;
    },
  );

  return (
    <ParticleContainer
      ref={pc => pc && (state.pc = pc)}
      properties={{
        alpha: true,
        position: true,
        rotation: true,
        scale: true,
        tint: true,
        uvs: true,
        vertices: true,
      }}
    />
  );
}

/**
 * @typedef Props @type {object}
 * @property {import('./WorldPixi').State} api
 * @property {(api: State) => void} onLoad
 */

/**
 * @typedef State @type {object}
 * @property {import('pixi.js').Texture} srcTex
 * @property {RenderTexture} tex
 * @property {import('pixi.js').ParticleContainer} pc
 * 
 * @property {import('rxjs').Subject<NPC.NPCsEvent>} events
 * @property {Record<string, NPC.NPC>} npc
 * @property {null | string} playerKey
 * @property {boolean} ready
 * @property {{ [sessionKey: string]: NPC.SessionCtxt }} session
 * @property {Required<NPC.NpcConfigOpts>} config Proxy
 *
 * @property {(src: Geomorph.PointMaybeMeta, dst: Geomorph.PointMaybeMeta, maxDistance?: number) => boolean} canSee
 * @property {(processApi: ProcessApi, npcKey: string) => NPC.NPC} connectNpcToProcess
 * @property {(sessionKey: string, opts?: { panzoomPid?: number }) => void} connectSession
 * @property {(sessionKey: string, opts?: { panzoomPid?: number }) => void} disconnectSession
 * @property {(src: Geom.VectJson, dst: Geom.VectJson, opts?: NPC.NavOpts & { endsNavigable?: boolean; }) => NPC.GlobalNavPath} getGlobalNavPath
 * @property {(visits: Geom.VectJson[], opts?: NPC.NavOpts) => NPC.GlobalNavPath} getGlobalTour
 * Get a single global nav-path visiting each point in `visits`.
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
 * @property {(npcKey: string | null) => void} setPlayerKey
 * @property {(e: { npcKey: string; npcClassKey?: NPC.NpcClassKey; point: Geomorph.PointMaybeMeta; angle?: number; requireNav?: boolean }) => Promise<void>} spawn
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
