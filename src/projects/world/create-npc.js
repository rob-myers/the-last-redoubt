import { css } from '@emotion/css';
import { cssName, obscuredNpcOpacity, spawnFadeMs } from './const';
import { Poly, Rect, Vect } from '../geom';
import { precision, testNever } from '../service/generic';
import { warn } from '../service/log';
import { getNumericCssVar, isAnimAttached, isPaused, isRunning } from '../service/dom';

import npcsMeta from './npcs-meta.json';

/**
 * @param {NPC.NPCDef} def 
 * @param {{ api: import('./World').State; }} deps
 * @returns {NPC.NPC}
 */
export default function createNpc(
  def,
  { api },
) {
  return {
    key: def.key,
    classKey: def.npcClassKey,
    epochMs: Date.now(),
    def,
    el: {
      root: /** @type {HTMLDivElement} */ ({}),
      body: /** @type {HTMLDivElement} */ ({}),
    },
    anim: {
      css: css`${npcsMeta[def.npcClassKey].css}`,
      path: [],
      aux: {
        angs: [],
        edges: [],
        elens: [],
        index: 0,
        outsetSegBounds: new Rect,
        outsetWalkBounds: new Rect,
        roomWalkBounds: new Rect,
        segBounds: new Rect,
        sofars: [],
        total: 0,
      },
      spriteSheet: 'idle',
      staticBounds: new Rect,
      staticPosition: new Vect,

      opacity: new Animation(),
      translate: new Animation(),
      rotate: new Animation(),
      sprites: new Animation(),
      durationMs: 0,
      speedFactor: 1,
      initAnimScaleFactor: 1000 / (def.speed * 1),
      updatedPlaybackRate: 1,
  
      gmRoomIds: [],
      prevWayMetas: [],
      wayMetas: [],
      wayTimeoutId: 0,
      doorStrategy: 'none',
    },
    
    doMeta: null,
    gmRoomId: null,
    has: {
      key: api.gmGraph.gms.map(_ => ({})),
    },
    manuallyPaused: false,
    unspawned: true,
    walkSpeedFactor: 1,

    async animateOpacity(targetOpacity, durationMs) {
      this.anim.opacity.cancel(); // Ensure prev anim removed?

      const animation = this.el.body.animate([
        { offset: 0 },
        { offset: 1, opacity: targetOpacity },
      ], { duration: durationMs, fill: 'forwards' });
      this.anim.opacity = animation;

      try {
        await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
          animation.addEventListener('finish', () => resolve());
          animation.addEventListener('cancel', () => reject(new Error('cancelled')));
        }));
      } finally {
        isAnimAttached(animation, this.el.body) && animation.commitStyles();
        if (animation.playState === 'finished') {
          animation.cancel();
        } else {// Reset opacity if cancelled
          this.el.body.style.opacity = '1';
        }
      }
    },
    async animateRotate(targetRadians, durationMs, throwOnCancel) {
      this.anim.rotate.cancel(); // Ensure prev anim removed?

      // ℹ️ assume source/targetRadians ∊ [-π, π]
      const sourceRadians = this.getAngle();
      if (targetRadians - sourceRadians > Math.PI) targetRadians -= 2 * Math.PI;
      if (sourceRadians - targetRadians > Math.PI) targetRadians += 2 * Math.PI;

      const { scale: npcScale } = npcsMeta[this.classKey];
      const animation = this.anim.rotate = this.el.body.animate([
        { offset: 0, transform: `rotate(${sourceRadians}rad) scale(${npcScale})` },
        { offset: 1, transform: `rotate(${targetRadians}rad) scale(${npcScale})` },
      ], { duration: durationMs, fill: 'forwards', easing: 'ease' });
  
      try {
        await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
          animation.addEventListener('finish', () => resolve());
          animation.addEventListener('cancel', () => reject(new Error('cancelled')));
        }));
      } catch (e) {
        if (!throwOnCancel && e instanceof Error && e.message === 'cancelled') { /** NOOP */ }
        else throw e;
      } finally {
        isAnimAttached(animation, this.el.body) && animation.commitStyles();
        animation.playState === 'finished' && animation.cancel();
      }
    },
    async cancel() {
      console.log(`cancel: cancelling ${this.def.key}`);
      this.manuallyPaused = false;

      const rootAnims = [this.anim.translate].filter(
        anim => anim.playState !== 'idle' && isAnimAttached(anim, this.el.root)
      );
      const bodyAnims = [this.anim.opacity, this.anim.rotate, this.anim.sprites].filter(
        anim => anim.playState !== 'idle' && isAnimAttached(anim, this.el.body)
      );

      if (this.anim.spriteSheet === 'walk') {
        this.clearWayMetas(); // Cancel pending actions
      }

      await Promise.all(rootAnims.concat(bodyAnims).map(anim => {
        (anim !== this.anim.sprites) && anim.commitStyles();
        return /** @type {Promise<void>} */ (new Promise(resolve => {
          anim.addEventListener('cancel', () => resolve());
          anim.cancel();
        }))
      }));

      api.npcs.events.next({ key: 'npc-internal', npcKey: this.key, event: 'cancelled' });
    },
    canLook() {
      return (
        (this.anim.spriteSheet === 'idle' || this.anim.spriteSheet === 'idle-breathe')
        && !this.doMeta
      );
    },
    canSee(npcKey) {
      
      // 🚧 working on getVantages first
      // 🚧 position-based check?

      // const other = api.npcs.getNpc(npcKey);
      // if (npcKey === this.key || this.gmRoomId === null || other.gmRoomId === null) {
      //   return false;
      // }

      // const { gmId, roomId } = this.gmRoomId;
      // const gm = api.gmGraph.gms[gmId];
      
      // if (isSameGmRoom(this.gmRoomId, other.gmRoomId)) {
      //   const [src, dst] = [this.getPosition(), other.getPosition()].map(gm.toLocalCoords);
      //   return !geom.outlineIntersectsSeg(gm.roomsWithDoors[roomId], src, dst);
      // }

      // const adjDoorIds = api.gmGraph.getGmRoomsDoorIds(this.gmRoomId, other.gmRoomId).filter(
      //   doorId => api.doors.isOpen(gmId, doorId)
      // );

      // if (adjDoorIds.length) {// Adj rooms
      //   // 🚧 clean

      //   // Raycast from npc and check intersection is one of the open doors
      //   let [src, dst] = [this.getPosition(), other.getPosition()].map(gm.toLocalCoords);
      //   const result = gm.rayIntersectsDoor(src, dst, roomId, adjDoorIds);
      //   if (result === null) return false;

      //   // Raycast from intersection to other npc
      //   const otherGm = api.gmGraph.gms[other.gmRoomId.gmId];
      //   [src, dst] = [
      //     new Vect(src.x + (result.lambda + 0.01) * (dst.x - src.x), src.y + (result.lambda + 0.01) * (dst.y - src.y)),
      //     other.getPosition(),
      //   ].map(otherGm.toLocalCoords);
      //   return !geom.outlineIntersectsSeg(otherGm.roomsWithDoors[roomId], src, dst);
      // }
      
      // if (false) {// Shared adj room
      //   // 🚧
      // }

      return false;
    },
    changeClass(npcClassKey) {// we don't trigger render
      this.classKey = npcClassKey;
      this.anim.css = css`${npcsMeta[npcClassKey].css}`;
    },
    clearWayMetas() {
      this.anim.wayMetas.length = 0;
      this.anim.prevWayMetas.length = 0; // 🚧 append to historical data?
      window.clearTimeout(this.anim.wayTimeoutId);
    },
    /**
     * This is `anim.aux.sofars[navMeta.index]`, except
     * `at-door` which is larger i.e. closer towards door.
     */
    computeWayMetaLength(navMeta) {
      if (navMeta.key === 'at-door') {
        const gm = api.gmGraph.gms[navMeta.gmId];
        const navPoint = gm.inverseMatrix.transformPoint(this.anim.path[navMeta.index].clone());
        const door = gm.doors[navMeta.doorId];
        const distanceToDoor = Math.abs(door.normal.dot(navPoint.sub(door.seg[0])));
        // change length so npc is close to door
        return Math.max(0, this.anim.aux.sofars[navMeta.index] + distanceToDoor - (this.getRadius() + 5));
      } else {
        return this.anim.aux.sofars[navMeta.index];
      }
    },
    everAnimated() {
      return this.el.root && isAnimAttached(this.anim.translate, this.el.root);
    },
    async fadeSpawnDo(point, opts = {}) {
      try {
        const meta = opts.meta ?? point.meta ?? {};
        await this.animateOpacity(0, opts.fadeOutMs ?? spawnFadeMs);
        point.meta ??= meta; // 🚧 can remove?
        await api.npcs.spawn({
          npcKey: this.key,
          point,
          angle: opts.angle,
          npcClassKey: opts.npcClassKey,
          requireNav: opts.requireNav,
        });
        this.startAnimationByMeta(meta);
        await this.animateOpacity(meta.obscured ? obscuredNpcOpacity : 1, spawnFadeMs);
      } catch (e) {
        await this.animateOpacity(this.doMeta?.obscured ? obscuredNpcOpacity : 1, spawnFadeMs);
        throw e;
      }
    },
    filterWayMetas(shouldRemove) {
      const { wayMetas } = this.anim;
      this.anim.wayMetas = wayMetas.filter(meta => !shouldRemove(meta));
      if (wayMetas[0] && shouldRemove(wayMetas[0])) {
        window.clearTimeout(this.anim.wayTimeoutId);
        this.nextWayTimeout();
      }
    },
    async followNavPath({ path, navMetas: globalNavMetas, gmRoomIds }, doorStrategy) {
      // warn('START followNavPath')
      // might jump i.e. path needn't start from npc position
      this.anim.path = path.map(Vect.from);
      // from `nav` for decor collisions
      this.anim.gmRoomIds = gmRoomIds;
      this.anim.doorStrategy = doorStrategy ?? 'none';
      this.anim.speedFactor = this.walkSpeedFactor;
      this.anim.updatedPlaybackRate = 1;

      this.clearWayMetas();
      this.resetAnimAux();
      
      if (path.length === 0) {
        return;
      }

      // Convert navMetas to wayMetas
      this.anim.wayMetas = globalNavMetas.map((navMeta) => ({
        ...navMeta,
        length: this.computeWayMetaLength(navMeta),
      }));
      // this.updateRoomWalkBounds(0);

      const continuous = this.getPosition().distanceTo(path[0]) <= 0.01;
      this.startAnimation('walk');
      api.npcs.events.next({
        key: 'started-walking',
        npcKey: this.def.key,
        continuous,
      });
      this.nextWayTimeout();
      console.log(`followNavPath: ${this.def.key} started walk`);

      const trAnim = this.anim.translate;
      try {
        await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
          trAnim.addEventListener('finish', () => {
            console.log(`followNavPath: ${this.def.key} finished walk`);
            this.wayTimeout(); // immediate else startAnimation('idle') will clear
            resolve();
          });
          trAnim.addEventListener('cancel', () => {
            // We cancel when finished e.g. startAnimation('idle'), to release control to styles
            if (trAnim.playState === 'paused' || trAnim.playState === 'running') {
              console.log(`followNavPath: ${this.def.key} cancelled walk`);
            }
            reject(new Error('cancelled'));
          });
        }));
      } finally {
        // Reset speed to default
        this.anim.speedFactor = this.walkSpeedFactor;
        // must commitStyles, otherwise it jumps
        isAnimAttached(trAnim, this.el.root) && trAnim.commitStyles();
        isAnimAttached(this.anim.rotate, this.el.body) && this.anim.rotate.commitStyles();
        // trigger cancel and clear wayMetas 
        this.startAnimation('idle'); // 🚧 remove hard-coding?
        api.npcs.events.next({ key: 'stopped-walking', npcKey: this.def.key });
      }

    },
    getAngle() {
      const matrix = new DOMMatrixReadOnly(window.getComputedStyle(this.el.body).transform);
      return Math.atan2(matrix.m12, matrix.m11);
    },
    getAnimScaleFactor() {
      // We convert from "seconds per world-unit" to "milliseconds per world-unit"
      return 1000 * (1 / this.getSpeed());
    },
    getInteractRadius() {
      // can inherit from <NPCs> root
      return parseFloat(getComputedStyle(this.el.root).getPropertyValue(cssName.npcsInteractRadius));
    },
    getLineSeg() {
      const dst = this.getTarget();
      if (dst) {
        const src = this.getPosition();
        return { src, dst, tangent: dst.clone().sub(src).normalize() };
      } else {
        return null;
      }
    },
    getNextDoorId() {
      return this.anim.wayMetas.find(
        /** @returns {meta is NPC.NpcWayMetaExitRoom} */
        meta => meta.key === 'exit-room' // stay in current gmId
      )?.doorId;
    },
    getPosition(useCache = true) {
      if (useCache && this.anim.spriteSheet !== 'walk') {
        return Vect.from(this.anim.staticPosition);
      } else {// 🚧 avoid getBoundingClientRect undefined
        const { x: clientX, y: clientY } = Vect.from(this.el.root.getBoundingClientRect?.() || [0, 0]);
        return Vect.from(api.panZoom.getWorld({ clientX, clientY })).precision(2);
      }
    },
    getPrevDoorId() {
      return this.anim.prevWayMetas.findLast(
        /** @returns {meta is NPC.NpcWayMetaExitRoom} */
        meta => meta.key === 'exit-room'
      )?.doorId;
    },
    getRadius() {
      return getNumericCssVar(this.el.root, cssName.npcBoundsRadius);
    },
    getSpeed() {
      return this.def.speed * this.anim.speedFactor;
    },
    getTarget() {
      if (this.isWalking()) {
        const { anim } = this;
        const soFarMs = /** @type {number} */ (anim.translate.currentTime);
        const nextIndex = anim.aux.sofars.findIndex(soFar => soFar * anim.initAnimScaleFactor > soFarMs);
        return nextIndex === -1 ? null : anim.path[nextIndex].clone(); // Expect -1 iff at final point
      } else {
        return null;
      }
    },
    getTargets() {
      if (this.isWalking()) {
        const { anim } = this;
        const soFarMs = /** @type {number} */ (anim.translate.currentTime);
        return anim.aux.sofars
          .map((soFar, i) => ({ point: anim.path[i].clone(), arriveMs: (soFar * anim.initAnimScaleFactor) - soFarMs }))
          .filter(x => x.arriveMs >= 0);
      } else {
        return [];
      }
    },
    getWalkAnimDef() {
      const { aux } = this.anim;
      const { scale: npcScale } = npcsMeta[this.classKey];
      return {
        translateKeyframes: this.anim.path.flatMap((p, i) => [
          {
            offset: aux.total === 0 ? 1 : (aux.sofars[i] / aux.total),
            transform: `translate(${p.x}px, ${p.y}px)`,
          },
        ]),
        rotateKeyframes: aux.total === 0 ? [] : this.anim.path.flatMap((p, i) => [
          {
            // offset: (aux.sofars[i] - 0.1 * (aux.elens[i - 1] ?? 0)) / aux.total,
            offset: aux.sofars[i] / aux.total,
            transform: `rotateZ(${aux.angs[i - 1] || aux.angs[i] || 0}rad) scale(${npcScale})`
          },
          {
            offset: aux.sofars[i] / aux.total,
            transform: `rotateZ(${aux.angs[i] || aux.angs[i - 1] || 0}rad) scale(${npcScale})`
          },
        ]),
        opts: {
          duration: aux.total * this.getAnimScaleFactor(),
          // ℹ️ Not recognised! If it worked, would probably need to adjust `duration`
          // playbackRate: this.anim.speedFactor,
          direction: 'normal',
          fill: 'forwards',
        },
      };
    },
    getWalkBounds() {
      return this.anim.aux.outsetWalkBounds;
    },
    getWalkCurrentTime() {
      // https://github.com/microsoft/TypeScript/issues/54496
      return /** @type {number | null} */ (this.anim.translate.currentTime);
    },
    getWalkCycleDuration(entireWalkMs) {
      const { parsed: { animLookup }, scale: npcScale } = npcsMeta[this.classKey];
      /**
       * Duration of a single walk cycle. Recalling that:
       * @see {entireWalkMs} is the duration of the entire walk.
       */
      const walkCycleMs = (animLookup.walk.totalDist * npcScale) * this.getAnimScaleFactor();

      /** Duration of final partial walk cycle */
      const partialMs = entireWalkMs % walkCycleMs;
      const numWalkCycles = Math.floor(entireWalkMs / walkCycleMs);

      /** Altered number of walk cycles */
      const altWalkCycles = partialMs <= 0.25 * walkCycleMs
        ? numWalkCycles
        : partialMs <= 0.75 * walkCycleMs
          ? numWalkCycles + 0.5
          : numWalkCycles + 1
      ;

      /**
       * Recalling `entireWalkMs = ((numWalkCycles * walkCycleMs) + partialMs)`
       * Seek `deltaMs` s.t. `entireWalkMs / (walkCycleMs + deltaMs) = altWalkCycles`
       * i.e. `walkCycleMs + deltaMs` occurs precisely `altWalkCycles` times.
       */
      const deltaMs = (entireWalkMs - walkCycleMs * altWalkCycles) / altWalkCycles;
      
      return walkCycleMs + deltaMs;
    },
    getWalkSegBounds(withNpcRadius) {
      return withNpcRadius
        ? this.anim.aux.outsetSegBounds
        : this.anim.aux.segBounds;
    },
    hasDoorKey(gmId, doorId) {
      return !!this.has.key[gmId]?.[doorId];
    },
    inferWalkTransform() {
      const position = new Vect;
      // 🚧 take account of playbackRate?
      const ratio = (this.getWalkCurrentTime() ?? 0) / this.anim.durationMs;
      // 🚧 seems our computation of angle is wrong sometimes
      let angle = 0;

      if (ratio === 0) {
        position.copy(this.anim.path[0]);
        angle = this.anim.aux.angs[0];
      } else if (ratio === 1) {
        position.copy(this.anim.path[this.anim.path.length - 1]);
        angle = this.anim.aux.angs[this.anim.aux.angs.length - 1];
      } else {
        const distance = ratio * this.anim.aux.total;
        const vertexId = Math.max(0, this.anim.aux.sofars.findIndex(sofar => sofar >= distance) - 1);
        position.copy(this.anim.path[vertexId]).addScaledVector(
          this.anim.path[vertexId + 1].clone().sub(this.anim.path[vertexId]),
          (distance - this.anim.aux.sofars[vertexId]) / this.anim.aux.elens[vertexId],
        );
        angle = this.anim.aux.angs[vertexId];
      }
      // this.el.root.style.transform = `translate(${position.x}px, ${position.y}px)`;
      // this.el.root.style.setProperty(cssName.npcTargetLookAngle, `${angle}rad`);
      return { position, angle };
    },
    inFrustum(point) {
      return api.npcs.inFrustum(
        this.getPosition(),
        point,
        this.getAngle(),
      );
    },
    initialize() {
      const { radius, scale: npcScale } = npcsMeta[this.classKey];
      this.el.root.style.transform = `translate(${this.def.position.x}px, ${this.def.position.y}px)`;
      this.el.root.style.setProperty(cssName.npcBoundsRadius, `${radius}px`);
      this.el.root.style.setProperty(cssName.npcHeadRadius, `${5}px`); // 🚧 remove hard-coding
      // Inherit cssName.npcsInteractRadius from <NPCS> unless specified
      this.el.body.style.transform = `rotate(${this.def.angle}rad) scale(${npcScale})`;
      this.anim.staticBounds = new Rect(this.def.position.x - radius, this.def.position.y - radius, 2 * radius, 2 * radius);
      this.anim.staticPosition.set(this.def.position.x, this.def.position.y);
      // Include doors so doorways have some gmRoomId too
      this.gmRoomId = api.gmGraph.findRoomContaining(this.def.position, true);
      // Ensure decor
      this.gmRoomId && api.decor.ensureByRoom(this.gmRoomId.gmId, this.gmRoomId.roomId);
    },
    intersectsCircle(position, radius) {
      return this.getPosition().distanceTo(position) <= this.getRadius() + radius;
    },
    isIdle() {
      return ['idle', 'idle-breathe'].includes(this.anim.spriteSheet);
    },
    isPaused() {
      return this.anim.sprites.playState === 'paused';
    },
    isPointBlocked(point, permitEscape = false) {
      const { npcs } = api;
      const closeNpcs = npcs.getCloseNpcs(this.key);
      const { radius } = npcsMeta[this.classKey];

      if (!closeNpcs.some(other =>
        other.intersectsCircle(point, radius)
        && npcs.handleBunkBedCollide(other.doMeta ?? undefined, point.meta)
      )) {
        return false;
      }

      const position = this.getPosition();
      if (permitEscape && closeNpcs.some(other =>
        other.intersectsCircle(position, radius)
        && npcs.handleBunkBedCollide(other.doMeta ?? undefined, this.doMeta ?? undefined)
      )) {
        return false;
      }

      return true;
    },
    isWalking() {
      return this.anim.spriteSheet === 'walk' && this.anim.translate.playState === 'running';
    },
    async lookAt(point) {
      const position = this.getPosition();
      const direction = Vect.from(point).sub(position);
      if (direction.length === 0) {
        return; // Don't animate
      }
      const targetRadians = Math.atan2(direction.y, direction.x);
      await this.animateRotate(targetRadians, 1 * 1000);
    },
    nextWayTimeout() {
      const currentTime = this.getWalkCurrentTime();
      if (currentTime === null) {
        return warn('nextWayTimeout: anim.translate.currentTime is null')
      } else if (this.anim.wayMetas[0]) {
        // Animation has uniform speed ∴ currentLength/currentTime = total/durationMs 
        const currentLength = this.anim.aux.total * (currentTime / this.anim.durationMs);
        const msToWait = (this.anim.wayMetas[0].length - currentLength) * this.getAnimScaleFactor() * (1 / this.anim.updatedPlaybackRate);
        this.anim.wayTimeoutId = window.setTimeout(this.wayTimeout.bind(this), msToWait);
      }
    },
    npcRef(rootEl) {
      if (rootEl) {
        this.el.root = rootEl;
        this.el.body = /** @type {HTMLDivElement} */ (rootEl.children[0]);
      }
    },
    obscureBySurfaces() {// 🚧 cleaner approach possible?
      if (this.gmRoomId) {
        const gm = api.gmGraph.gms[this.gmRoomId.gmId];
        const worldSurfaces = (gm.roomSurfaceIds[this.gmRoomId.roomId] ?? [])
          .map(id => gm.groups.obstacles[id].poly.clone().applyMatrix(gm.matrix))
        ;
        const position = this.getPosition();
        const npcSurfaces = worldSurfaces.map(x => x.translate(-position.x, -position.y));
        const { scale } = npcsMeta[this.def.npcClassKey];
        // Interact radius should contain everything, including CSS drop-shadow
        const maxDim = 2 * (this.getInteractRadius() / scale);
        const localBounds = Poly.fromRect(new Rect(-maxDim/2, -maxDim/2, maxDim, maxDim)).scale(scale);
        const inverted = Poly.cutOut(npcSurfaces, [localBounds]);
        this.el.root.style.clipPath = `path("${inverted.map(poly => poly.svgPath)}")`;
      } else {
        warn('cannot obscure npc: npc does not reside in any room');
        this.el.root.style.clipPath = 'none';
      }
    },
    pause(dueToProcessSuspend = false) {
      if (!dueToProcessSuspend) {
        this.manuallyPaused = true;
      } // We permit re-pause when manuallyPaused      

      console.log(`pause: pausing ${this.def.key}`);
      const { opacity, rotate, sprites, translate } = this.anim;
      isRunning(opacity) && opacity.pause();
      isRunning(translate) && translate.pause();
      isRunning(rotate) && rotate.pause();
      isRunning(sprites) && sprites.pause();
      if (this.anim.spriteSheet === 'walk') {
        /**
         * Pending wayMeta is at this.anim.wayMetas[0].
         * No need to adjust its `length` because we use animation currentTime.
         */
        window.clearTimeout(this.anim.wayTimeoutId);
      }

      api.npcs.events.next({ key: 'npc-internal', npcKey: this.key, event: 'paused' });
    },
    resetAnimAux() {
      const { aux } = this.anim;
      const radius = this.getRadius();
      aux.outsetWalkBounds = Rect.fromPoints(...this.anim.path).outset(radius);
      aux.edges = this.anim.path.map((p, i) => ({ p, q: this.anim.path[i + 1] })).slice(0, -1);
      aux.angs = aux.edges.map(e => precision(Math.atan2(e.q.y - e.p.y, e.q.x - e.p.x)));
      // accuracy needed for wayMeta length computation
      aux.elens = aux.edges.map(({ p, q }) => p.distanceTo(q));
      // aux.elens = aux.edges.map(({ p, q }) => precision(p.distanceTo(q)));
      // aux.navPathPolys = aux.edges.map(e => {
      //   const normal = e.q.clone().sub(e.p).rotate(Math.PI/2).normalize(0.01);
      //   return new Poly([e.p.clone().add(normal), e.q.clone().add(normal), e.q.clone().sub(normal), e.p.clone().sub(normal)]);
      // });
      const reduced = aux.elens.reduce((agg, length) => {
        agg.total += length;
        agg.sofars.push(agg.sofars[agg.sofars.length - 1] + length);
        return agg;
      }, { sofars: [0], total: 0 });
      aux.sofars = reduced.sofars
      aux.total = reduced.total;
      aux.index = 0;
    },
    resume(dueToProcessResume = false) {
      if (this.manuallyPaused && dueToProcessResume) {
        return;
      }
      this.manuallyPaused = false;

      console.log(`resume: resuming ${this.def.key}`);
      const { opacity, rotate, sprites, translate } = this.anim;
      isPaused(opacity) && opacity.play();
      isPaused(translate) && translate.play();
      isPaused(rotate) && rotate.play();
      isPaused(sprites) && sprites.play();
      if (this.anim.spriteSheet === 'walk') {
        this.nextWayTimeout();
      }

      api.npcs.events.next({ key: 'npc-internal', npcKey: this.key, event: 'resumed' });
    },
    setInteractRadius(radius) {
      if (typeof radius === 'number') {
        this.el.root.style.setProperty(cssName.npcsInteractRadius, `${radius}px`);
      } else {
        this.el.root.style.removeProperty(cssName.npcsInteractRadius);
      }
    },
    startAnimation(spriteSheet) {
      if (spriteSheet !== this.anim.spriteSheet) {
        this.el.root.classList.remove(this.anim.spriteSheet);
        this.el.root.classList.add(spriteSheet);
        this.anim.spriteSheet = spriteSheet;
      }
      if (this.everAnimated()) {
        this.anim.translate.cancel();
        this.anim.rotate.cancel();
        this.anim.sprites.cancel();
      }
      switch (this.anim.spriteSheet) {
        case 'walk': {
          const { anim } = this;
          // this.el.root.getAnimations().forEach(x => x.cancel());
          isAnimAttached(anim.rotate, this.el.body) && anim.rotate.commitStyles(); // else sometimes jerky on start/end walk
          anim.rotate.cancel(); // else `npc do` orientation doesn't work
          // isAnimAttached(anim.sprites, this.el.body) && anim.sprites.cancel();
    
          // Animate position and rotation
          const { translateKeyframes, rotateKeyframes, opts } = this.getWalkAnimDef();
          anim.translate = this.el.root.animate(translateKeyframes, opts);
          anim.rotate = this.el.body.animate(rotateKeyframes, opts);
          anim.durationMs = opts.duration;
          anim.initAnimScaleFactor = this.getAnimScaleFactor();

          // Animate spritesheet, assuming `walk` anim exists
          const { animLookup } = npcsMeta[this.classKey].parsed;
          const spriteMs = opts.duration === 0 ? 0 : this.getWalkCycleDuration(opts.duration);
          const firstFootLeads = Math.random() < 0.5; // TODO spriteMs needs modifying?
          anim.sprites = this.el.body.animate(
              firstFootLeads ?
                [
                  { offset: 0, backgroundPosition: '0px' },
                  { offset: 1, backgroundPosition: `${-animLookup.walk.frameCount * animLookup.walk.frameAabb.width}px` },
                ] :
                [// We assume an even number of frames
                  { offset: 0, backgroundPosition: `${-animLookup.walk.frameCount * 1/2 * animLookup.walk.frameAabb.width}px` },
                  { offset: 1, backgroundPosition: `${-animLookup.walk.frameCount * 3/2 * animLookup.walk.frameAabb.width}px` },
                ] 
            ,
            {
              easing: `steps(${animLookup.walk.frameCount})`,
              duration: spriteMs, // 🚧 ~ npcWalkAnimDurationMs
              iterations: Infinity,
              delay: opts.delay,
              playbackRate: opts.playbackRate,
            },
          );
          break;
        }
        case 'idle':
        case 'idle-breathe':
        case 'lie':
        case 'sit': {
          this.clearWayMetas();
          // Update staticBounds
          const { x, y } = this.getPosition(false);
          const radius = this.getRadius();
          this.anim.staticBounds.set(x - radius, y - radius, 2 * radius, 2 * radius);
          this.anim.staticPosition.set(x, y);
    
          if (this.anim.spriteSheet === 'sit') {
            this.obscureBySurfaces(); // Ensure feet are below surfaces
          } else {
            this.el.root.style.clipPath = 'none';
          }

          // - Maybe fixes "this.anim.translate.addEventListener is not a function"
          // - Maybe fixes "this.anim.rotate.cancel is not a function" on HMR
          this.anim.translate = new Animation();
          this.anim.rotate = new Animation();
          
          // ℹ️ relax type of keys
          // 🚧 npc classes should have same Object.keys(animLookup)
          const animLookup = /** @type {Record<string, NPC.NpcAnimMeta>} */ (npcsMeta[this.classKey].parsed.animLookup);

          // Always play an animation so can detect if paused
          this.anim.sprites = this.el.body.animate(
            [
              { offset: 0, backgroundPosition: '0px' },
              // Works even if frameCount is 1 because easing is `steps(1)`
              { offset: 1, backgroundPosition: `${-animLookup[this.anim.spriteSheet].frameCount * animLookup[this.anim.spriteSheet].frameAabb.width}px` },
            ], {
              easing: `steps(${animLookup[this.anim.spriteSheet].frameCount})`,
              duration: animLookup[this.anim.spriteSheet].durationMs,
              iterations: Infinity,
            },
          );
          break;
        }
        default:
          throw testNever(this.anim.spriteSheet, { suffix: 'create-npc.startAnimation' });
      }
    },
    startAnimationByMeta(meta) {
      switch (true) {
        case meta.sit:
          this.startAnimation('sit');
          break;
        case meta.stand:
          this.startAnimation('idle-breathe');
          break;
        case meta.lie:
          this.startAnimation('lie');
          break;
      }
      this.doMeta = meta.do ? meta : null;
    },
    setSpeedFactor(speedFactor, temporary = true) {
      if (this.anim.spriteSheet === 'walk') {
        /** Infer initial speedFactor from initialAnimScaleFactor */
        const initSpeedFactor = (1 / this.anim.initAnimScaleFactor) * (1000 / this.def.speed);
        this.anim.updatedPlaybackRate = speedFactor / initSpeedFactor;
        this.anim.translate.updatePlaybackRate(this.anim.updatedPlaybackRate);
        this.anim.rotate.updatePlaybackRate(this.anim.updatedPlaybackRate);
        this.anim.sprites.updatePlaybackRate(this.anim.updatedPlaybackRate);
        if (!temporary) {// By default, speed changes whilst walking are temporary
          this.walkSpeedFactor = speedFactor;
        }
      } else {// If currently stopped, speed change isn't temporary
        this.walkSpeedFactor = speedFactor;
      }
      if (this.anim.speedFactor === speedFactor) {
        return; // Else infinite loop?
      }
      api.npcs.events.next({ key: 'changed-speed', npcKey: this.key, prevSpeedFactor: this.anim.speedFactor, speedFactor });
      this.anim.speedFactor = speedFactor;
    },
    updateRoomWalkBounds(srcIndex) {
      // We start from vertex 0 or an `exit-room`, and look for next `exit-room`
      const dstIndex = this.anim.wayMetas.find(x => x.key === 'exit-room')?.index;
      const points = this.anim.path.slice(srcIndex, dstIndex);
      this.anim.aux.roomWalkBounds = Rect.fromPoints(...points);
    },
    updateWalkSegBounds(index) {
      const { aux, path } = this.anim;
      aux.index = index;
      aux.segBounds.copy(Rect.fromPoints(path[index], path[index + 1]));
      aux.outsetSegBounds.copy(aux.segBounds).outset(this.getRadius());
    },
    /**
     * 🚧 avoid many short timeouts?
     */
    wayTimeout() {
      // console.warn('wayTimeout next:', this.anim.wayMetas[0]);
      const currentTime = this.getWalkCurrentTime();
      const metaLength = this.anim.wayMetas[0]?.length;

      if (metaLength === undefined) {
        return console.warn('wayTimeout: empty wayMetas');
      } else if (this.anim.spriteSheet !== 'walk') {
        return console.warn(`wayTimeout: not walking: ${this.anim.spriteSheet}`);
      } else if (currentTime === null) {
        return console.warn('wayTimeout: currentTime is null');
      } else if (this.anim.translate.playState === 'paused') {
        return; // This handles World pause
      }

      /** @type {NPC.NpcWayMeta} */ let wayMeta;
      if (currentTime >= (metaLength * this.anim.initAnimScaleFactor) - 1) {
        // Reached wayMeta's `length`, so remove/trigger respective event (+adjacents)
        while (this.anim.wayMetas[0]?.length <= metaLength) {
          // console.warn('wayMeta shift', this.anim.wayMetas[0])
          this.anim.prevWayMetas.push(wayMeta = /** @type {NPC.NpcWayMeta} */ (this.anim.wayMetas.shift()));
          api.npcs.events.next({ key: 'way-point', npcKey: this.def.key, meta: wayMeta });
        }
      } else {
        // console.warn(
        //   'wayTimeout not ready',
        //   this.anim.wayMetas[0],
        //   this.anim.translate.currentTime,
        //   this.anim.translate.effect?.getTiming().duration,
        //   this.anim.wayMetas[0].length * this.getAnimScaleFactor(),
        // );
      }
      this.nextWayTimeout();
    },
  };
}

const tempRect = new Rect;
