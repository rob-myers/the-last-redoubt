import { css } from '@emotion/css';
import { Poly, Rect, Vect } from '../geom';
import { testNever } from '../service/generic';
import { cancellableAnimDelayMs, cssName } from '../service/const';
import { getNumericCssVar, isAnimAttached, isPaused, isRunning } from '../service/dom';
import npcsMeta from './npcs-meta.json';

/**
 * @param {NPC.NPCDef} def 
 * @param {{ disabled?: boolean; api: import('./World').State; }} deps
 * @returns {NPC.NPC}
 */
export default function createNpc(
  def,
  { disabled, api },
) {
  return {
    key: def.key,
    jsonKey: def.npcJsonKey,
    epochMs: Date.now(),
    def,
    el: {
      root: /** @type {HTMLDivElement} */ ({}),
      body: /** @type {HTMLDivElement} */ ({}),
    },
    unspawned: true,
    anim: {
      // 🚧 can specify character class
      css: css`${npcsMeta['first-human-npc'].css}`,
      path: [],
      aux: { angs: [], bounds: new Rect, edges: [], elens: [], navPathPolys: [], sofars: [], total: 0, index: 0, segBounds: new Rect },
      spriteSheet: 'idle',
      staticBounds: new Rect,

      opacity: new Animation(),
      translate: new Animation(),
      rotate: new Animation(),
      sprites: new Animation(),
      durationMs: 0,
  
      wayMetas: [],
      wayTimeoutId: 0,
    },

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
      }
    },
    async animateRotate(targetRadians, durationMs, throwOnCancel) {
      this.anim.rotate.cancel(); // Ensure prev anim removed?

      // ℹ️ assume source/targetRadians ∊ [-π, π]
      const sourceRadians = this.getAngle();
      if (targetRadians - sourceRadians > Math.PI) targetRadians -= 2 * Math.PI;
      if (sourceRadians - targetRadians > Math.PI) targetRadians += 2 * Math.PI;

      const { scale: npcScale } = npcsMeta[this.jsonKey];
      const animation = this.el.body.animate([
        { offset: 0, transform: `rotate(${sourceRadians}rad) scale(${npcScale})` },
        { offset: 1, transform: `rotate(${targetRadians}rad) scale(${npcScale})` },
      ], { duration: durationMs, fill: 'forwards', easing: 'ease' });
      this.anim.rotate = animation;
  
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
      }
    },
    async cancel() {
      console.log(`cancel: cancelling ${this.def.key}`);

      /** @type {Animation['playState'][]} */
      const playStates = ['running', 'paused'];
      const rootAnims = [this.anim.translate].filter(
        anim => isAnimAttached(anim, this.el.root, playStates)
      );
      const bodyAnims = [this.anim.opacity, this.anim.rotate, this.anim.sprites].filter(
        anim => isAnimAttached(anim, this.el.body, playStates)
      );

      await Promise.all(rootAnims.concat(bodyAnims).map(anim => {
        anim.commitStyles();
        return /** @type {Promise<void>} */ (new Promise(resolve => {
          anim.addEventListener('cancel', () => resolve());
          anim.cancel();
        }))
      }));

      if (this.anim.spriteSheet === 'walk') {// Cancel pending actions
        this.clearWayMetas();
      }
      if (this.def.key === api.npcs.playerKey) {// Cancel camera tracking
        api.panZoom.animationAction('smooth-cancel');
      }
    },
    clearWayMetas() {
      this.anim.wayMetas.length = 0;
    },
    everAnimated() {
      return this.el.root && isAnimAttached(this.anim.translate, this.el.root);
    },
    async followNavPath(path, opts) {
      this.anim.path = path.map(Vect.from);
      this.clearWayMetas();
      this.updateAnimAux();
      if (this.anim.path.length <= 1 || this.anim.aux.total === 0) {
        return;
      }
            
      if (opts?.globalNavMetas) {
        this.anim.wayMetas = opts.globalNavMetas.map((navMeta) => ({
          ...navMeta,
          // We take advantage of precomputed this.anim.aux.sofars
          length: Math.max(0, this.anim.aux.sofars[navMeta.index] + navMetaOffsets[navMeta.key]),
        }));
      }

      this.startAnimation('walk');
      api.npcs.events.next({ key: 'started-walking', npcKey: this.def.key });
      console.log(`followNavPath: ${this.def.key} started walk`);
      this.nextWayTimeout();

      const trAnim = this.anim.translate;
      try {
        await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
          trAnim.addEventListener('finish', () => {
            console.log(`followNavPath: ${this.def.key} finished walk`);
            resolve();
          });
          trAnim.addEventListener('cancel', () => {
            if (trAnim.playState !== 'finished') {
              // We'll also cancel when finished to release control to styles
              console.log(`followNavPath: ${this.def.key} cancelled walk`);
            }
            reject(new Error('cancelled'));
          });
        }));
      } finally {
        // must commitStyles, otherwise it jumps
        isAnimAttached(trAnim, this.el.root) && trAnim.commitStyles();
        isAnimAttached(this.anim.rotate, this.el.body) && this.anim.rotate.commitStyles();
        this.startAnimation('idle'); // 🚧 remove hard-coding?
        api.npcs.events.next({ key: 'stopped-walking', npcKey: this.def.key });
      }

    },
    getAngle() {
      const matrix = new DOMMatrixReadOnly(window.getComputedStyle(this.el.body).transform);
      return Math.atan2(matrix.m12, matrix.m11);
    },
    getAnimDef() {
      const { aux } = this.anim;
      const { scale: npcScale } = npcsMeta[this.jsonKey];
      return {
        translateKeyframes: this.anim.path.flatMap((p, i) => [
          {
            offset: aux.sofars[i] / aux.total,
            transform: `translate(${p.x}px, ${p.y}px)`,
          },
        ]),
        rotateKeyframes: this.anim.path.flatMap((p, i) => [
          {
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
          direction: 'normal',
          fill: 'forwards',
        },
      };
    },
    getAnimScaleFactor() {
      // We convert from seconds/world-unit to milliseconds/world-unit
      return 1000 * (1 / this.getSpeed());
    },
    getBounds() {
      const center = this.getPosition();
      const radius = this.getRadius();
      return new Rect(center.x - radius,center.y - radius, 2 * radius, 2 * radius);
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
    getPosition() {
      // TODO avoid getBoundingClientRect undefined
      const { x: clientX, y: clientY } = Vect.from(this.el.root.getBoundingClientRect?.() || [0, 0]);
      return Vect.from(api.panZoom.getWorld({ clientX, clientY })).precision(2);
    },
    getRadius() {
      return getNumericCssVar(this.el.root, cssName.npcBoundsRadius);
    },
    getSpeed() {
      return this.def.speed;
    },
    /**
     * Shorten duration of this.anim.sprites slightly,
     * ensuring we finish at nice 0-based frame (0 or 5).
     * - we ensure half returned value divides `motionMs`
     * - we use an offset `motionMs` to end mid-frame
     */
    getWalkSpriteDuration(nextMotionMs) {
      const { parsed: { animLookup }, scale: npcScale } = npcsMeta[this.jsonKey];
      const npcWalkAnimDurationMs = 1000 * ( 1 / this.getSpeed() ) * (animLookup.walk.totalDist * npcScale);
      const baseSpriteMs = npcWalkAnimDurationMs;
      const motionMs = nextMotionMs - (0.5 * (npcWalkAnimDurationMs / animLookup.walk.frameCount));
      return motionMs < baseSpriteMs / 2
        ? baseSpriteMs // degenerate case
        // Alternatively, use Math.floor for longer duration
        : (2 * motionMs) / Math.ceil(2 * (motionMs / baseSpriteMs));
    },
    getTarget() {
      if (this.isWalking()) {
        const soFarMs = /** @type {number} */ (this.anim.translate.currentTime);
        const nextIndex = this.anim.aux.sofars.findIndex(sofar => (sofar * this.getAnimScaleFactor()) > soFarMs);
        // Expect -1 iff at final point
        return nextIndex === -1 ? null : this.anim.path[nextIndex].clone();
      } else {
        return null;
      }
    },
    getTargets() {
      if (this.isWalking()) {
        const soFarMs = /** @type {number} */ (this.anim.translate.currentTime);
        const animScaleFactor = this.getAnimScaleFactor();
        return this.anim.aux.sofars
          .map((sofar, i) => ({ point: this.anim.path[i].clone(), arriveMs: (sofar * animScaleFactor) - soFarMs }))
          .filter(x => x.arriveMs >= 0)
      } else {
        return [];
      }
    },
    getWalkBounds() {
      return this.anim.aux.bounds;
    },
    getWalkSegBounds() {
      return this.anim.aux.segBounds;
    },
    inferWalkTransform() {
      const position = new Vect;
      const ratio = (this.anim.translate.currentTime || 0) / this.anim.durationMs;
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
    initialize() {
      this.el.root.style.transform = `translate(${this.def.position.x}px, ${this.def.position.y}px)`;
      const { radius, scale: npcScale } = npcsMeta[this.jsonKey];
      this.el.root.style.setProperty(cssName.npcBoundsRadius, `${radius}px`);
      this.el.root.style.setProperty(cssName.npcHeadRadius, `${5}px`); // 🚧 remove hard-coding
      this.el.body.style.transform = `rotate(${this.def.angle}rad) scale(${npcScale})`;
      this.anim.staticBounds = new Rect(this.def.position.x - radius, this.def.position.y - radius, 2 * radius, 2 * radius);
      this.unspawned = false;
    },
    isIdle() {
      return ['idle', 'idle-breathe'].includes(this.anim.spriteSheet);
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
      if (this.anim.translate.currentTime === null) {
        return console.warn('nextWayTimeout: this.anim.root.currentTime is null')
      } else if (this.anim.wayMetas[0]) {
        this.anim.wayTimeoutId = window.setTimeout(
          this.wayTimeout.bind(this),
          (this.anim.wayMetas[0].length * this.getAnimScaleFactor()) - this.anim.translate.currentTime,
        );
      }
    },
    npcRef(rootEl) {
      if (rootEl) {
        this.el.root = rootEl;
        this.el.body = /** @type {HTMLDivElement} */ (rootEl.children[0]);
      }
    },
    pause() {
      console.log(`pause: pausing ${this.def.key}`);
      const { opacity, rotate, sprites, translate } = this.anim;
      isRunning(opacity) && opacity.pause();
      switch (this.anim.spriteSheet) {
        case 'idle':
        case 'sit':
        case 'idle-breathe':
          isRunning(rotate) && rotate.pause();
          isRunning(sprites) && sprites.pause();
          break;
        case 'walk':
          isRunning(translate) && translate.pause();
          isRunning(rotate) && rotate.pause();
          isRunning(sprites) && sprites.pause();
          /**
           * Pending wayMeta is at this.anim.wayMetas[0].
           * No need to adjust its `length` because we use animation currentTime.
           */
          window.clearTimeout(this.anim.wayTimeoutId);
          break;
        default:
          throw testNever(this.anim.spriteSheet, { suffix: 'create-npc.pause' });
      }

      if (this.def.key === api.npcs.playerKey) {
        // Pause camera tracking
        api.panZoom.animationAction('pause');
      }
    },
    resume() {
      console.log(`resuming ${this.def.key}`);
      const { opacity, rotate, sprites, translate } = this.anim;
      isPaused(opacity) && opacity.play();
      switch (this.anim.spriteSheet) {
        case 'idle':
        case 'sit':
        case 'idle-breathe':
          isPaused(rotate) && rotate.play();
          isPaused(sprites) && sprites.play();
          break;
        case 'walk':
          isPaused(translate) && translate.play();
          isPaused(rotate) && rotate.play();
          isPaused(sprites) && sprites.play();
          this.nextWayTimeout();
          if (this.def.key === api.npcs.playerKey) {
            // Resume camera tracking
            api.panZoom.animationAction('play');
          }
          break;
        default:
          throw testNever(this.anim.spriteSheet, { suffix: 'create-npc.play' });
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
          const { translateKeyframes, rotateKeyframes, opts } = this.getAnimDef();
          opts.delay ||= cancellableAnimDelayMs;
          anim.translate = this.el.root.animate(translateKeyframes, opts);
          anim.rotate = this.el.body.animate(rotateKeyframes, opts);
          anim.durationMs = opts.duration;

          // Animate spritesheet, assuming `walk` anim exists
          const { animLookup, aabb } = npcsMeta[this.jsonKey].parsed;
          const spriteMs = this.getWalkSpriteDuration(opts.duration);
          const firstFootLeads = Math.random() < 0.5; // TODO spriteMs needs modifying?
          anim.sprites = this.el.body.animate(
              firstFootLeads ?
                [
                  { offset: 0, backgroundPosition: '0px' },
                  { offset: 1, backgroundPosition: `${-animLookup.walk.frameCount * aabb.width}px` },
                ] :
                [// We assume an even number of frames
                  { offset: 0, backgroundPosition: `${-animLookup.walk.frameCount * 1/2 * aabb.width}px` },
                  { offset: 1, backgroundPosition: `${-animLookup.walk.frameCount * 3/2 * aabb.width}px` },
                ] 
            ,
            {
              easing: `steps(${animLookup.walk.frameCount})`,
              duration: spriteMs, // ~ npcWalkAnimDurationMs
              iterations: Infinity,
              delay: opts.delay || cancellableAnimDelayMs,
            },
          );
          break;
        }
        case 'idle':
        case 'idle-breathe':
        case 'sit': {
          this.clearWayMetas();
          // Update staticBounds
          const { x, y } = this.getPosition();
          const radius = this.getRadius();
          this.anim.staticBounds.set(x - radius, y - radius, 2 * radius, 2 * radius);
    
          // - Maybe fixes "this.anim.translate.addEventListener is not a function"
          // - Maybe fixes "this.anim.rotate.cancel is not a function" on HMR
          this.anim.translate = new Animation();
          this.anim.rotate = new Animation();
          
          if (this.anim.spriteSheet === 'idle-breathe') {
            const { animLookup, aabb, synfigMeta } = npcsMeta[this.jsonKey].parsed;
            this.anim.sprites = this.el.body.animate(
              [
                { offset: 0, backgroundPosition: '0px' },
                { offset: 1, backgroundPosition: `${-animLookup['idle-breathe'].frameCount * aabb.width}px` },
              ], {
                easing: `steps(${animLookup['idle-breathe'].frameCount})`,
                duration: 600, // 🚧
                iterations: Infinity,
                direction: /** @type {PlaybackDirection   | undefined} */ (synfigMeta.keyframeToMeta[this.anim.spriteSheet]?.['animation-direction']),
              },
            );
          }
          // this.anim.sprites = this.el.body.animate([], { duration: 2 * 1000, iterations: Infinity });
          break;
        }
        default:
          throw testNever(this.anim.spriteSheet, { suffix: 'create-npc.startAnimation' });
      }
    },
    startAnimationByMeta(meta) {
      switch (true) {
        case meta.sit: {
          this.startAnimation('sit');
          break;
        }
        case meta.stand: {
          this.startAnimation('idle-breathe');
          break;
        }
        case meta.lie: {
          // 🚧
          break;
        }
      }
    },
    updateAnimAux() {
      const { aux } = this.anim;
      const radius = this.getRadius();
      aux.bounds = Rect.fromPoints(...this.anim.path).outset(radius);
      aux.edges = this.anim.path.map((p, i) => ({ p, q: this.anim.path[i + 1] })).slice(0, -1);
      aux.angs = aux.edges.map(e => Number(Math.atan2(e.q.y - e.p.y, e.q.x - e.p.x).toFixed(2)));
      aux.elens = aux.edges.map(({ p, q }) => Number(p.distanceTo(q).toFixed(2)));
      aux.navPathPolys = aux.edges.map(e => {
        const normal = e.q.clone().sub(e.p).rotate(Math.PI/2).normalize(0.01);
        return new Poly([e.p.clone().add(normal), e.q.clone().add(normal), e.q.clone().sub(normal), e.p.clone().sub(normal)]);
      });
      const reduced = aux.elens.reduce((agg, length) => {
        agg.total += length;
        agg.sofars.push(agg.sofars[agg.sofars.length - 1] + length);
        return agg;
      }, { sofars: [0], total: 0 });
      aux.sofars = reduced.sofars
      aux.total = reduced.total;
      aux.index = 0;
    },
    updateWalkSegBounds(index) {
      this.anim.aux.index = index;
      this.anim.aux.segBounds.copy(
        Rect.fromPoints(
          this.anim.path[index],
          this.anim.path[index + 1],
        ).outset(this.getRadius())
      );
    },
    /**
     * 🚧 cleanup
     * 🚧 avoid many short timeouts
     */
    wayTimeout() {
      // console.log('this.anim.wayMetas[0]', this.anim.wayMetas[0]);
      if (
        this.anim.wayMetas.length === 0
        || this.anim.spriteSheet !== 'walk'
        || this.anim.translate.currentTime === null
        || this.anim.translate.playState === 'paused'
      ) {
        if (this.anim.wayMetas.length === 0) console.warn('wayTimeout: empty this.anim.wayMetas');
        if (this.anim.translate.currentTime === null) console.warn('wayTimeout: this.anim.root.currentTime is null');
        if (this.anim.spriteSheet !== 'walk') console.warn(`wayTimeout: this.anim.spriteSheet (${this.anim.spriteSheet}) is not "walk"`);
        return;
      } else if (
        this.anim.translate.currentTime >=
        (this.anim.wayMetas[0].length * this.getAnimScaleFactor()) - 1
      ) {
        /**
         * We've reached the wayMeta's `length`,
         * so remove it and trigger respective event.
         */
        const wayMeta = /** @type {NPC.NpcWayMeta} */ (this.anim.wayMetas.shift());
        // console.info('wayMeta', this.key, wayMeta); // DEBUG 🚧
        api.npcs.events.next({ key: 'way-point', npcKey: this.def.key, meta: wayMeta });
      }
      this.nextWayTimeout();
    },
  };
}

/** @type {Record<Graph.NavMetaKey, number>} */
const navMetaOffsets = {
  'enter-room': -0.02, // To ensure triggered
  'exit-room': -0.02, // To ensure triggered
  'pre-collide': -0.02, // To ensure triggered

  /**
   * 🚧 compute collision time using `predictNpcRectCollision`
   * 🚧 can specify character class
   */
  "pre-exit-room": -(npcsMeta['first-human-npc'].radius + 10), // TODO better way
  "pre-near-door": -(npcsMeta['first-human-npc'].radius + 10), // TODO better way

  "start-seg": 0,
};
