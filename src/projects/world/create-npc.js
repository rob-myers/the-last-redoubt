import { Poly, Rect, Vect } from '../geom';
import { testNever } from '../service/generic';
import { cancellableAnimDelayMs, cssName } from '../service/const';
import { getNumericCssVar, isAnimAttached, lineSegToCssTransform } from '../service/dom';
import { npcJson } from '../service/npc-json';

/**
 * @param {import('./NPC').PropsDef} def 
 * @param {{ disabled?: boolean; api: import('./World').State; }} deps
 * @returns {NPC.NPC}
 */
export default function createNpc(
  def,
  { disabled, api },
) {
  return {
    key: def.npcKey,
    jsonKey: def.npcJsonKey,
    epochMs: Date.now(),
    def: { key: def.npcKey, position: def.position, angle: def.angle, paused: !!disabled },
    el: {
      root: /** @type {HTMLDivElement} */ ({}),
      body: /** @type {HTMLDivElement} */ ({}),
    },
    mounted: false,
    anim: {
      css: npcJson['first-anim'].css,
      path: [],
      aux: { angs: [], bounds: new Rect, edges: [], elens: [], navPathPolys: [], sofars: [], total: 0, index: 0, segBounds: new Rect },
      spriteSheet: 'idle',
      staticBounds: new Rect,

      translate: /** @type {Animation} */ ({}),
      rotate: /** @type {Animation} */ ({}),
      sprites: /** @type {Animation} */ ({}),
      durationMs: 0,
  
      wayMetas: [],
      wayTimeoutId: 0,
    },

    async cancel() {
      console.log(`cancel: cancelling ${this.def.key}`);
      switch (this.anim.spriteSheet) {
        case 'idle':
        case 'sit':
          break;
        case 'walk':
          this.clearWayMetas();
          this.commitWalkStyles();
          if (this.el.body instanceof HTMLDivElement) {
            this.setLookRadians(this.getAngle());
          }
          await /** @type {Promise<void>} */ (new Promise(resolve => {
            this.anim.translate.addEventListener('cancel', () => resolve());
            this.anim.translate.cancel();
            this.anim.rotate.cancel();
          }));
          break;
        default:
          throw testNever(this.anim.spriteSheet, { suffix: 'create-npc.cancel' });
      }

      if (this.def.key === api.npcs.playerKey) {
        // Cancel camera tracking
        api.panZoom.animationAction('smooth-cancel');
      }
    },
    clearWayMetas() {
      this.anim.wayMetas.length = 0;
    },
    commitWalkStyles() {
      this.anim.translate.commitStyles();
      this.el.root.style.setProperty(cssName.npcLookRadians, `${this.getAngle()}rad`);
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

      this.setSpritesheet('walk');
      this.startAnimation();
      api.npcs.events.next({ key: 'started-walking', npcKey: this.def.key });
      console.log(`followNavPath: ${this.def.key} started walk`);
      this.nextWayTimeout();

      try {
        await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
          this.anim.translate.addEventListener('finish', () => {
            console.log(`followNavPath: ${this.def.key} finished walk`);
            resolve();
          });
          this.anim.translate.addEventListener('cancel', () => {
            if (!this.anim.translate.finished) {
              console.log(`followNavPath: ${this.def.key} cancelled walk`);
            } // We also cancel when finished to release control to styles
            reject(new Error('cancelled'));
          });
        }));
      } finally {
        this.setSpritesheet('idle');
        this.commitWalkStyles();
        this.startAnimation();
        api.npcs.events.next({ key: 'stopped-walking', npcKey: this.def.key });
      }

    },
    getAngle() {
      const matrix = new DOMMatrixReadOnly(window.getComputedStyle(this.el.body).transform);
      return Math.atan2(matrix.m12, matrix.m11);
    },
    getAnimDef() {
      const { aux } = this.anim;
      const { scale: npcScale } = npcJson[this.jsonKey];
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
      return def.speed;
    },
    /**
     * Shorten duration of this.anim.sprites slightly,
     * ensuring we finish at nice 0-based frame (0 or 5).
     * - we ensure half returned value divides `motionMs`
     * - we use an offset `motionMs` to end mid-frame
     */
    getSpriteDuration(nextMotionMs) {
      const { parsed: { animLookup }, scale: npcScale } = npcJson[this.jsonKey];
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
    isWalking() {
      return this.anim.spriteSheet === 'walk' && this.anim.translate.playState === 'running';
    },
    lookAt(point) {
      const position = this.getPosition();
      const direction = Vect.from(point).sub(position);
      if (direction.length === 0) {
        return this.getAngle();
      }
      // Ensure we don't turn more than 180 deg
      const targetLookRadians = getNumericCssVar(this.el.root, cssName.npcLookRadians);
      let radians = Math.atan2(direction.y, direction.x);
      while (radians - targetLookRadians > Math.PI) radians -= 2 * Math.PI;
      while (targetLookRadians - radians > Math.PI) radians += 2 * Math.PI;
      this.setLookRadians(radians); // Only works when idle, otherwise overridden
      return radians;
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
      if (rootEl && !this.mounted) {
        this.el.root = rootEl;
        this.el.body = /** @type {HTMLDivElement} */ (rootEl.childNodes[0]);

        this.el.root.style.transform = `translate(${this.def.position.x}px, ${this.def.position.y}px)`;
        this.setLookRadians(def.angle);
        const { radius } = npcJson[this.jsonKey];
        this.el.root.style.setProperty(cssName.npcBoundsRadius, `${radius}px`);

        this.anim.staticBounds = new Rect(
          this.def.position.x - radius, this.def.position.y - radius, 2 * radius, 2 * radius
        );
        this.mounted = true;
      }
    },
    pause() {
      console.log(`pause: pausing ${this.def.key}`);
      switch (this.anim.spriteSheet) {
        case 'idle':
        case 'sit':
          break;
        case 'walk':
          if (this.everAnimated()) {
            this.anim.translate.pause();
            this.anim.rotate.pause();
            this.anim.sprites.pause();
            this.commitWalkStyles();
            this.setLookRadians(this.getAngle());
          }
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
    play() {
      console.log(`play: resuming ${this.def.key}`);
      switch (this.anim.spriteSheet) {
        case 'idle':
        case 'sit':
          break;
        case 'walk':
          this.anim.translate.play();
          this.anim.rotate.play();
          this.anim.sprites.play();
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
    setLookRadians(radians) {
      this.el.root.style.setProperty(cssName.npcLookRadians, `${radians}rad`);
    },
    setSpritesheet(spriteSheet) {
      if (spriteSheet !== this.anim.spriteSheet) {
        this.el.root.classList.remove(this.anim.spriteSheet);
        this.el.root.classList.add(spriteSheet);
        this.anim.spriteSheet = spriteSheet;
      }
    },
    startAnimation() {
      if (this.everAnimated()) {
        this.anim.translate.cancel();
        this.setLookRadians(this.getAngle());
        this.anim.rotate.cancel();
      }

      switch (this.anim.spriteSheet) {
        case 'walk': {
          // Remove pre-existing, else:
          // - strange behaviour on pause
          // - final body rotation can be wrong
          this.el.root.getAnimations().forEach(x => x.cancel());
          this.el.body.getAnimations().forEach(x => x.cancel());
    
          // Animate position and rotation
          const { translateKeyframes, rotateKeyframes, opts } = this.getAnimDef();
          opts.delay ||= cancellableAnimDelayMs;
          this.anim.translate = this.el.root.animate(translateKeyframes, opts);
          this.anim.rotate = this.el.body.animate(rotateKeyframes, opts);
          this.anim.durationMs = opts.duration;
    
          // Animate spritesheet
          const { animLookup } = npcJson[this.jsonKey].parsed;
          const spriteMs = this.getSpriteDuration(opts.duration);
          const firstFootLeads = Math.random() < 0.5; // TODO spriteMs needs modifying?
          this.anim.sprites = this.el.body.animate(
              firstFootLeads ?
                [
                  { offset: 0, backgroundPosition: '0px' },
                  { offset: 1, backgroundPosition: `${-animLookup.walk.frameCount * animLookup.walk.aabb.width}px` },
                ] :
                [// We assume an even number of frames
                  { offset: 0, backgroundPosition: `${-animLookup.walk.frameCount * 1/2 * animLookup.walk.aabb.width}px` },
                  { offset: 1, backgroundPosition: `${-animLookup.walk.frameCount * 3/2 * animLookup.walk.aabb.width}px` },
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
        case 'sit': {
          this.clearWayMetas();
          this.setLookRadians(this.getAngle());
          // Update staticBounds
          const { x, y } = this.getPosition();
          const radius = this.getRadius();
          this.anim.staticBounds.set(x - radius, y - radius, 2 * radius, 2 * radius);
    
          // Replace with dummy animations?
          // - Maybe fixes "this.anim.translate.addEventListener is not a function"
          // - Fixes "this.anim.rotate.cancel is not a function" on HMR
          this.anim.translate = this.el.root.animate([], { duration: 2 * 1000, iterations: Infinity });
          this.anim.rotate = this.el.body.animate([], { duration: 2 * 1000, iterations: Infinity });
          // this.anim.sprites = this.el.body.animate([], { duration: 2 * 1000, iterations: Infinity });
          break;
        }
        default:
          throw testNever(this.anim.spriteSheet, { suffix: 'create-npc.startAnimation' });
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
   * 🚧 should compute collision time using `predictNpcSegCollision`
   */
  "pre-exit-room": -(npcJson['first-anim'].radius + 10), // TODO better way
  "pre-near-door": -(npcJson['first-anim'].radius + 10), // TODO better way

  "start-seg": 0,
};
