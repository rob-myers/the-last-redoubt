import { merge } from 'rxjs';
import { assertNonNull, keys, testNever } from './generic';
import { npcWorldRadius } from './const';
import { Rect, Vect } from '../geom';
import { geom } from './geom';
import { observableToAsyncIterable } from './observable-to-async-iterable';

class NpcService {

  defaultNavPathName = /** @type {const} */ ('navpath-default');

  //#region individual npc

  /**
   * Choose scale factor s.t. npc radius becomes `14.4`.
   * - Starship Geomorphs grid is 60 * 60.
   * - Approx 1.5m * 1.5m hence npc radius ~ 36cm
   * @param {{ radius: number }} parsed 
   */
  computeNpcScale(parsed) {
    return npcWorldRadius / parsed.radius;
  }

  /**
   * @param {NPC.ParsedNpc} parsed
   */
  computeSpritesheetCss(parsed) {
    const scale = this.computeNpcScale(parsed);
    return `
  .body {
    transform: scale(${scale});
  }

  ${Object.values(parsed.animLookup).map(({ animName, frameAabb }) => `
    &.${animName} .body:not(.webp) {
      width: ${frameAabb.width}px;
      height: ${frameAabb.height}px;
      left: ${-frameAabb.width * 0.5}px;
      top: ${-frameAabb.height * 0.5}px;
      background-image: url('/assets/npc/${parsed.npcClassKey}/${parsed.npcClassKey}--${animName}.png');
    }
    &.${animName} .body.webp {
      width: ${frameAabb.width}px;
      height: ${frameAabb.height}px;
      left: ${-frameAabb.width * 0.5}px;
      top: ${-frameAabb.height * 0.5}px;
      background-image: url('/assets/npc/${parsed.npcClassKey}/${parsed.npcClassKey}--${animName}.webp');
    }
  `).join('\n\n')}
  `.trim();
  }


  /**
   * Compute `NPC.NpcAction` from `npc {action} {opts} [extras[i]]`.
   *
   * For example, we can open a clicked door via
   * `npc do rob $( click 1 ) 1` where:
   * - `{action}` is `do`
   * - `{opts}` is `"rob"`
   * - `{extras[0]}` is a point
   * - `{extras[1]}` is `1`
   * 
   * Then this function would output:
   * `{ action: 'do', npcKey: 'rob', point, extraParams: 1 }`.
   * @param {NPC.NpcActionKey} action
   * @param {undefined | string | NPC.NpcConfigOpts} opts
   * @param {any[]} extras 
   * @returns {NPC.NpcAction}
   */
  normalizeNpcCommandOpts(action, opts, extras) {
    if (typeof opts === "string") {
      switch (action) {
        case "decor":
          // npc decor {decorKey}
          return { action: 'decor', decorKey: opts }; // get
        case "remove-decor":
        case "rm-decor":
          // npc {remove-decor,rm-decor} {decorKey}
          return { action: 'remove-decor', decorKey: opts };
        case "rm":
        case "remove":
          // npc {rm,remove} {npcKey}
          return { action: 'rm', npcKeys: opts.split(' ').concat(extras) };
        case "set-player":
          // npc set-player {npcKey}
          return { action: 'set-player', npcKey: opts };
        case "get":
          // npc get {npcKey} [selectorFunction]
          // npc get {npcKey} [selectorString] [args]*
          return { action: 'get', npcKey: opts, selector: extras[0], extraArgs: extras.slice(1) };
        case "config":
          // npc config {boolOptionToToggle}+, e.g.
          // npc config omnipresent showLabels
          // npc config 'omnipresent showLabels'
          return { action: 'config', configKey: [opts].concat(extras).join(' ') };
        case "map":
          // npc map {action} [secs]
          // 👉 npc map show-for-secs [secs] => npc map show-for-ms [secs * 1000]
          const mapAction = opts === "show-for-secs" ? "show-for-ms" : /** @type {NPC.FovMapAction} */ (opts);
          return { action: 'map', mapAction, timeMs: typeof extras[0] === 'number' ? extras[0] * 1000 : undefined };
        case "add-decor":
        case "events": // Only `npc events` supported
        case "light":
          throw Error(`Unsupported syntax: npc ${action} ${opts}`);
        default:
          throw testNever(action, { suffix: 'normalizeNpcCommandOpts' });
      }
    } else if (opts) {// opts is `NPC.NpcConfigOpts`
      switch (action) {
        case "config":
          // npc config {partialConfig}
          // > e.g. npc config '{ omnipresent: true, interactRadius: 100 }'
          return { action: 'config', ...opts };
        case "decor":
        case "add-decor":
          // npc decor {decorDef}
          return { action: 'add-decor', items: [/** @type {NPC.DecorDef} */ (opts)] }; // add
        case "light":
          // npc light {pointInRoom} # toggle
          // npc light {pointInRoom} {truthy} # on
          // npc light {pointInRoom} {falsy}  # off
          return { action: 'light', point: /** @type {Geomorph.PointMaybeMeta} */ (opts), lit: extras[0] };
        case "map":
        case "events":
        case "get":
        case "remove-decor":
        case "rm-decor":
        case "rm":
        case "remove":
        case "set-player":
          throw Error(`Unsupported syntax: npc ${action} ${JSON.stringify(opts)}`);
        default:
          throw testNever(action, { suffix: 'normalizeNpcCommandOpts' });
      }
    } else {// opts is `undefined`
      switch (action) {
        case "decor":
          // npc decor
          return { action: 'decor' }; // list all
        case "events":
          // npc events
          return { action: 'events' };
        case "add-decor":
        case "config":
          // npc config
          return { action: 'config' }; // get all
        case "set-player":
          // npc set-player
          return { action: 'set-player' }; // unset Player
        case "get":
          // npc get
          return { action: 'get' }; // list all
        case "light":
        case "map":
        case "remove-decor":
        case "rm-decor":
        case "rm":
        case "remove":
          throw Error(`Unsupported syntax: npc ${action}`);
        default:
          throw testNever(action, { suffix: 'normalizeNpcCommandOpts' });
      }
    }
  }

  //#endregion

  //#region keys

  /** @type {Record<NPC.ConfigBooleanKey, true>} */
  fromConfigBooleanKey = { canClickArrows: true, debug: true, debugPlayer: true, gmOutlines: true, hideGms: true, highlightWindows: true, localNav: true, localOutline: true, logTags: true, omnipresent: true, scriptDoors: true, showIds: true, showColliders: true, verbose: true };

  fromConfigBooleanKeys = keys(this.fromConfigBooleanKey);

  /** @type {Record<NPC.FovMapAction, true>} */
  fromFovMapActionKey = { "hide": true, "show": true, "show-for-ms": true, "pause": true, "resume": true };

  fovMapActionKeys = keys(this.fromFovMapActionKey);

  /** @type {Record<NPC.NpcActionKey, true>} */
  fromNpcActionKey = { "add-decor": true, config: true, decor: true, events: true, get: true, light: true, map: true, rm: true, "remove": true, "remove-decor": true, "rm-decor": true, "set-player": true };

  /** @type {Record<NPC.NpcClassKey, true>} */
  fromNpcClassKey = { "first-human-npc": true, solomani: true, vilani: true, zhodani: true };

  /**
   * @param {string} input 
   * @returns {input is NPC.ConfigBooleanKey}
   */
  isConfigBooleanKey = (input) => {
    return input in this.fromConfigBooleanKey;
  }

  /**
   * @param {string} input 
   * @returns {input is NPC.NpcActionKey}
   */
  isNpcActionKey = (input) => {
    return this.fromNpcActionKey[/** @type {NPC.NpcActionKey} */ (input)] ?? false;
  }

  /**
   * @param {string} input 
   * @returns {input is NPC.NpcClassKey}
   */
  isNpcClassKey = (input) => {
    return input in this.fromNpcClassKey;
  }

  //#endregion

  //#region collision

  /**
   * Npc center vs static circle.
   * @param {NPC.NPC} npcA 
   * @param {NPC.DecorCircle} decorB
   * @returns {{ collisions: NPC.NpcCollision[]; startInside: boolean; }}
  */
  predictNpcCircleCollision(npcA, decorB) {
    if (!npcA.isWalking()) {
      return { collisions: [], startInside: npcA.getPosition().distanceToSquared(decorB.center) < decorB.radius ** 2 };
    }
    if (!npcA.getWalkSegBounds(false).intersectsCentered(decorB.center.x, decorB.center.y, 2 * decorB.radius)) {
      return { collisions: [], startInside: false };
    }
    /**
     * Solving `a.t^2 + b.t + c ≤ 0`,
     * - `a := speedA^2`
     * - `b := 2.speedA.dpA`
     * - `c := distABSq - minDist^2`
     * 
     * Solutions are
     * ```js
     * (-b ± √(b^2 - 4ac)) / 2a // i.e.
     * (-b ± 2.speedA.√inSqrt) / 2a
     * ```
     */
    const segA = assertNonNull(npcA.getLineSeg());
    const iAB = segA.src.clone().sub(decorB.center);
    const distABSq = iAB.lengthSquared;
    const dpA = segA.tangent.dot(iAB);

    // strict inequality avoids degenerate case?
    const startInside = distABSq < decorB.radius ** 2;
    const inSqrt = (dpA ** 2) - distABSq + (decorB.radius ** 2);
    
    if (inSqrt <= 0) {// No solution, or glancing collision
      return { collisions: [], startInside };
    }
    
    const collisions = /** @type {NPC.NpcCollision[]} */ ([]);
    const speedA = npcA.getSpeed();
    /** Time at which npc is at @see {segA.dst} */
    const tMax = segA.src.distanceTo(segA.dst) / speedA;

    /** Earlier of the two solutions */
    const t1 = (-dpA - Math.sqrt(inSqrt)) * (1 / speedA);
    if (t1 > tMax) {// Early exit
      return { collisions: [], startInside };
    }

    /** Later of the two solutions */
    let t2 = (-dpA + Math.sqrt(inSqrt)) * (1 / speedA);
    if (t1 >= 0) {
      collisions.push({ seconds: t1, distA: t1 * speedA, distB: 0 });
    }
    if (t2 >= 0 && t2 <= tMax) {
      collisions.push({ seconds: t2, distA: t2 * speedA, distB: 0 });
    }

    return { collisions, startInside };
  }

  /**
   * @param {NPC.NPC} npcA Assumed to be moving
   * @param {NPC.NPC} npcB May not be moving
   * @returns {NPC.NpcCollision | null}
   */
  predictNpcNpcCollision(npcA, npcB) {
    if (!npcA.isWalking()) {
      return null; // Maybe stopped in time for event to fire?
    }
    if (npcB.isWalking()) {
      if (!npcA.getWalkSegBounds(true).intersects(npcB.getWalkSegBounds(true))) {
        return null;
      }
      /**
       * seg vs seg
       * 
       * Solving `a.t^2 + b.t + c ≤ 0`,
       * - `a := speedA^2 + speedB^2 - 2.speedA.speedB.dirDp`
       * - `b := 2.(speedA.dpA - speedB.dpB)`
       * - `c := distABSq - minDist^2`
       * 
       * Solutions are
       * ```js
       * (-b ± √(b^2 - 4ac)) / 2a // i.e.
       * (-b ± √inSqrt) / 2a
       * ```
       */
      const segA = assertNonNull(npcA.getLineSeg());
      const segB = assertNonNull(npcB.getLineSeg());
      const dirDp = segA.tangent.dot(segB.tangent);
      /** Vector from npc B to A */
      const iAB = segA.src.clone().sub(segB.src);
      const distABSq = iAB.lengthSquared;
      const dpA = segA.tangent.dot(iAB);
      const dpB = segB.tangent.dot(iAB);
      const speedA = npcA.getSpeed();
      const speedB = npcB.getSpeed();
      const minDistSq = ((npcA.getRadius() + npcB.getRadius()) * 0.9) ** 2;

      // ℹ️ "optimization" fails if one npc catches the other up,
      //    either via greater speed OR by walking into their side
      // if (dpA >= 0 || dpB <= 0) {// NPCs not moving towards each other
      //   return null;
      // }
      if (distABSq <= minDistSq) {// Already colliding
        return { seconds: 0, distA: 0, distB: 0 };
      }

      const a = (speedA ** 2) + (speedB ** 2) - 2 * speedA * speedB * dirDp;
      const b = 2 * (speedA * dpA - speedB * dpB);
      const c = distABSq - minDistSq;

      const inSqrt = (b ** 2) - (4 * a * c);
      const timeA = segA.src.distanceTo(segA.dst) / speedA;
      const timeB = segB.src.distanceTo(segB.dst) / speedB;
      /**
       * Linear motion only valid until 1st target reached
       * Subsequent collisions handled via 'vertex' or 'stopped-walking'.
       */
      const maxTime = Math.min(timeA, timeB);

      /** Potential solution to quadratic (seconds) */
      let t = 0;
      if (
        inSqrt > 0 &&
        (t = (-b - Math.sqrt(inSqrt)) / (2 * a)) <= maxTime
        && t >= 0 // -ve solutions possible if npcs have different speeds
      ) {// 0 <= seconds <= time to reach segA.dst
        return { seconds: t, distA: t * speedA, distB: t * speedB };
      } else {
        return null;
      }

    } else {// npcB is standing still
      if (!npcA.getWalkSegBounds(true).intersects(npcB.anim.staticBounds)) {
        return null;
      }
      /**
       * seg vs static
       * 
       * Solving `a.t^2 + b.t + c ≤ 0`,
       * - `a := speedA^2`
       * - `b := 2.speedA.dpA`
       * - `c := distABSq - minDist^2`
       * 
       * Solutions are
       * ```js
       * (-b ± √(b^2 - 4ac)) / 2a // i.e.
       * (-b ± 2.speedA.√inSqrt) / 2a
       * ```
       */
      const segA = assertNonNull(npcA.getLineSeg());
      const iAB = segA.src.clone().sub(npcB.getPosition());
      const distABSq = iAB.lengthSquared;
      const dpA = segA.tangent.dot(iAB);
      const speedA = npcA.getSpeed();
      const minDistSq = ((npcA.getRadius() + npcB.getRadius()) * 0.9) ** 2;

      if (dpA >= 0) {// NPC A not moving towards B
        return null;
      }
      if (distABSq <= minDistSq) {// Already colliding
        return { seconds: 0, distA: 0, distB: 0 };
      }

      const inSqrt = (dpA ** 2) - distABSq + minDistSq;

      /** Potential solution to quadratic (seconds) */
      let t = 0;
      if (
        inSqrt > 0 &&
        (t = (-dpA - Math.sqrt(inSqrt)) * (1 / speedA)) <=
        (segA.src.distanceTo(segA.dst) / speedA)
        // && t >= 0 // Not possible via early bounds check
      ) {
        return { seconds: t, distA: t * speedA, distB: 0 };
      } else {
        return null;
      }
    }
  }

  /**
   * Npc center vs static polygon.
   * @param {NPC.NPC} npcA viewed as single point
   * @param {Geom.VectJson[]} outline static polygon outline
   * @param {Geom.Rect} [rect] defaults to `Rect.fromPoints(...outline)`
   * @returns {{ collisions: NPC.NpcCollision[]; startInside: boolean; }}
   */
  predictNpcPolygonCollision(npcA, outline, rect) {
    if (outline.length < 3) {
      return { collisions: [], startInside: false };
    }
    if (!npcA.getTarget()) {// Not walking or at final point
      return { collisions: [], startInside: geom.outlineContains(outline, npcA.getPosition(), null) };
    }
    if (!npcA.getWalkSegBounds(false).intersects(rect || Rect.fromPoints(...outline))) {
      return { collisions: [], startInside: false };
    }
    
    const segA = assertNonNull(npcA.getLineSeg());
    const speedA = npcA.getSpeed();
    const startInside = geom.outlineContains(outline, segA.src, null);

    outline.push(outline[0]);
    // 🚧 avoid checking every segment
    // - restrict to +ve dot product inside
    // - restrict to -ve dot product outside
    const distances = outline.reduce((agg, p, i) => {
      if (outline[i + 1]) {
        /** λ ∊ [0, 1] of `segA.dst - segA.src` */
        const scaleFactor = geom.getLineSegsIntersection(segA.src, segA.dst, p, outline[i + 1]);
        (scaleFactor !== null) && agg.push(scaleFactor * segA.src.distanceTo(segA.dst));
      }
      return agg;
    }, /** @type {number[]} */ ([]));
    outline.pop();

    distances.sort((a, b) => a < b ? -1 : 1);

    return {
      collisions: distances.map(distance => ({ seconds: distance / speedA, distA: distance, distB: 0 })),
      startInside,
    };
  }

  //#endregion

  //#region navpath

  /**
   * - Shares vectors in path.
   * - Only constructs shallow-clone of navMetas.
   * @param {NPC.GlobalNavPath} navPath 
   * @return {NPC.GlobalNavPath} 
   */
  cloneNavPath({ key, path, edgeNodeIds, navMetas, gmRoomIds }) {
    return {
      key,
      path: path.slice(),
      edgeNodeIds: edgeNodeIds.map(x => x.slice()),
      // Shallow clone sufficient?
      // Optional chaining for safety?
      navMetas: navMetas?.map(meta => ({ ...meta })) ?? [],
      gmRoomIds: {...gmRoomIds},
    };
  }

  /**
   * Concatenate compatible nav paths i.e.
   * with matching final/initial vertices.
   * @param {NPC.GlobalNavPath[]} navPaths
   * @returns {NPC.GlobalNavPath}
   */
  concatenateNavPaths(navPaths) {
    if (navPaths.length === 1) {
      return navPaths[0];
    } else {
      return navPaths.reduce((agg, { name, path, gmRoomIds, navMetas, edgeNodeIds }, i) => {
        // -1 because remove prune vertex 0
        const vertexOffset = i === 0 ? 0 : agg.path.length - 1;
        // 🚧 first navMeta always 'vertex'?
        agg.navMetas.push(...navMetas.slice(i === 0 ? 0 : 1)
          .map(meta => ({ ...meta, index: meta.index + vertexOffset }))
        );
        Object.entries(gmRoomIds).forEach(([k, v]) =>
          // 🤔 We do not exclude `k === 0`
          agg.gmRoomIds[Number(k) + vertexOffset] = v
        );
        // agg.gmRoomIds.push(...i === 0 ? gmRoomIds : gmRoomIds.slice(1));
        agg.name = name; // name of last navpath
        agg.edgeNodeIds.push(...edgeNodeIds);
        agg.path.push(...i === 0 ? path : path.slice(1));
        return agg;
      }, this.getEmptyNavPath());
    }
  }

  /** @returns {NPC.GlobalNavPath} */
  getEmptyNavPath() {
    return { key: 'global-nav', path: [], navMetas: [], edgeNodeIds: [], gmRoomIds: {} };
  }

  /**
   * @param {string | Geom.VectJson} [navRep]
   */
  getNavPathName(navRep) {
    return navRep === undefined
      ? `empty-navpath`
      : typeof navRep === 'string'
        ? `navpath-for-${navRep}` // npcKey
        : `navpath-from-point`
  }

  /**
   * 🚧 check gmRoomIds are properly sliced
   * @param {NPC.GlobalNavPath} navPath 
   * @param {number} [startId] from vertex {startId} (possibly -ve)
   * @param {number} [endId] to (not including) vertex {endId} (possibly -ve)
   * @returns {NPC.GlobalNavPath}
   */
  sliceNavPath(navPath, startId, endId) {
    let { key, path, edgeNodeIds, navMetas = [], gmRoomIds } = navPath;

    path = path.slice(startId, endId);
    edgeNodeIds = edgeNodeIds.slice(startId, endId === undefined ? endId : Math.max(0, endId - 1));
    navMetas = navMetas.slice();

    if (typeof endId === 'number') {
      if (endId < 0) endId += navPath.path.length;
      const postMetaId = navMetas.findIndex(meta => meta.index >= /** @type {number} */ (endId));
      postMetaId >= 0 && (navMetas = navMetas.slice(0, postMetaId));
      for (const k of Object.keys(gmRoomIds)) {
        if (Number(k) >= endId) delete gmRoomIds[/** @type {*} */ (k)];
      }
    }

    if (typeof startId === 'number') {
      if (startId < 0) startId += navPath.path.length;
      const preMetaId = navMetas.findIndex(meta => meta.index >= /** @type {number} */ (startId));
      preMetaId >= 0 && (navMetas = navMetas.slice(preMetaId)
        .map(meta => ({ ...meta, index: meta.index - /** @type {number} */ (startId) }))
      );
      for (const [k, v] of Object.entries(gmRoomIds)) {
        delete gmRoomIds[/** @type {*} */ (k)];
        if (Number(k) >= startId) {
          gmRoomIds[Number(k) - startId] = v;
        } else {// Ensure `0` has a gmRoomId
          gmRoomIds[0] = v;
        }
      }
    }

    return {
      key,
      path,
      edgeNodeIds,
      gmRoomIds,
      navMetas,
    };
  }

  /** @param {NPC.LocalNavPath} input */
  verifyLocalNavPath(input) {
    let x = /** @type {Partial<NPC.LocalNavPath>} */ (input);
    return x?.key === 'local-nav'
      && x.path?.every?.(Vect.isVectJson)
      && Array.isArray(x.navMetas)
      || false;
  }

  /**
   * @param {any} input
   * @returns {input is NPC.GlobalNavPath}
   */
  verifyGlobalNavPath(input) {
    let x = /** @type {Partial<NPC.GlobalNavPath>} */ (input);
    return x?.key === 'global-nav'
      && x.path?.every?.(Vect.isVectJson)
      && Array.isArray(x.navMetas)
      || false;
  }

  //#endregion

  //#region process

  /**
   * For `npc events`
   * @param {import('../world/World').State} worldApi 
   * @param {import('../sh/cmd.service').CmdService['processApi']} processApi
   */
  async *yieldEvents(worldApi, processApi) {
    const asyncIterable = observableToAsyncIterable(merge(
      worldApi.doors.events,
      worldApi.npcs.events,
      worldApi.panZoom.events,
    ));
    // ℹ️ couldn't catch asyncIterable.throw?.(api.getKillError())
    const process = processApi.getProcess();
    process.cleanups.push(() => asyncIterable.return?.());
    for await (const event of asyncIterable) {
      if (processApi.isRunning()) yield event;
    }
    // ℹ️ get here via `kill` or e.g. failed pipe-sibling
    throw processApi.getKillError();
  }

  //#endregion
}

export const npcService = new NpcService;

/**
 * @typedef {NpcService} NpcServiceType
 */