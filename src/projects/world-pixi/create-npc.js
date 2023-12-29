import { Texture, Rectangle } from "@pixi/core";
import { Sprite } from "@pixi/sprite";
import TWEEN from '@tweenjs/tween.js';

import { Rect, Vect } from '../geom';
import spineMeta from "static/assets/npc/top_down_man_base/spine-meta.json";
import { npcClassToSpineHeadSkin, spineAnimToSetup } from "./const";

/**
 * @param {NPC.NPCDef} def
 * @param {import('./WorldPixi').State} api
 * //@returns {NPC.NPC}
 */
export default function createNpc(def, api) {
  const { baseTexture } = api.npcs.tex;
  const sharedAnimData = getSharedAnimData('idle');
  const headSkinName = npcClassToSpineHeadSkin[def.classKey];

  return {
    key: def.key,
    classKey: def.classKey,
    epochMs: Date.now(),
    def,

    el: /** @type {*} */ ({}), // Fix types during migration
    s: {
      body: new Sprite(new Texture(baseTexture)),
      head: new Sprite(new Texture(baseTexture)),
    },

    anim: /** @type {*} */ ({}), // Fix types during migration
    a: {
      shared: sharedAnimData,
      durations: getAnimDurations(sharedAnimData, def.walkSpeed),
      initHeadWidth: spineMeta.head[headSkinName].packedHead.top.width,

      path: [],
      aux: {
        angs: [],
        edges: [],
        elens: [],
        index: 0,
        outsetSegBounds: new Rect,
        outsetWalkBounds: new Rect,
        // roomWalkBounds: new Rect,
        segBounds: new Rect,
        sofars: [],
        total: 0,
      },
      staticBounds: new Rect,
      staticPosition: new Vect,
      
      animName: 'idle',
      opacity: emptyTween,
      rotate: emptyTween,
      
      doorStrategy: 'none',
      gmRoomIds: [],
      prevWayMetas: [],
      wayMetas: [],
      wayTimeoutId: 0,
    },

    doMeta: null,
    forcePaused: false,
    gmRoomId: null,
    has: { key: api.gmGraph.gms.map(_ => ({})) },
    navOpts: {
      centroidsFallback: true,
      closedWeight: 10 * 1000, // avoid closed doors (?)
    },
    navPath: null,
    nextWalk: null,
    unspawned: true,

    // 🚧 methods
    
    // @ts-ignore
    async animateOpacity(targetOpacity, durationMs) {
      this.a.opacity.stop();
      try {
        await (this.a.opacity = api.tween([this.s.body, this.s.head]).to([
          { alpha: targetOpacity },
          { alpha: targetOpacity },
        ], durationMs)).promise();
      } catch (e) {// Reset opacity if cancelled
        [this.s.body, this.s.head].forEach(s => s.alpha = 1);
        throw Error('cancelled');
      }
    },

    // @ts-ignore
    async animateRotate(targetRadians, durationMs, throwOnCancel) {
      this.a.rotate.stop();
    
      // Assume {source,target}Radians in [-π, π]
      const sourceRadians = this.getAngle();
      if (targetRadians - sourceRadians > Math.PI) targetRadians -= 2 * Math.PI;
      if (sourceRadians - targetRadians > Math.PI) targetRadians += 2 * Math.PI;

      try {
        await (this.a.rotate = api.tween([this.s.body, this.s.head]).to([
          { rotation: targetRadians },
          { rotation: targetRadians },
        ], durationMs).easing(TWEEN.Easing.Quadratic.In)).promise();
      } catch {
        if (throwOnCancel) throw new Error('cancelled');
      }
    },
    // @ts-ignore
    async cancel(overridePaused = false) {
      if (this.forcePaused && !overridePaused) {
        throw Error('paused: cannot cancel');
      }

      console.log(`cancel: cancelling ${this.def.key}`);

      this.a.opacity.stop();
      this.a.rotate.stop();

      if (this.a.animName === 'walk') {
        this.nextWalk = null;
        this.clearWayMetas(); // Cancel pending actions
        this.startAnimation('idle'); // Must change to stop walking?
      }
      
      api.npcs.events.next({ key: 'npc-internal', npcKey: this.key, event: 'cancelled' });
    },

    clearWayMetas() {
      this.a.wayMetas.length = 0;
      this.a.prevWayMetas.length = 0;
      window.clearTimeout(this.a.wayTimeoutId);
    },
    getAngle() {
      return this.s.body.rotation;
    },
    // @ts-ignore
    startAnimation(animName) {
    //   if (spriteSheet !== this.anim.spriteSheet) {
    //     this.el.root.classList.remove(this.anim.spriteSheet);
    //     this.el.root.classList.add(spriteSheet);
    //     this.anim.spriteSheet = spriteSheet;
    //   }
    //   if (isAnimAttached(this.anim.translate, this.el.root)) {
    //     this.anim.translate.cancel();
    //     this.anim.rotate.cancel();
    //     this.anim.sprites.cancel();
    //   }
    //   switch (this.anim.spriteSheet) {
    //     case 'walk': {
    //       const { anim } = this;
    //       // this.el.root.getAnimations().forEach(x => x.cancel());
    //       isAnimAttached(anim.rotate, this.el.body) && anim.rotate.commitStyles(); // else sometimes jerky on start/end walk
    //       anim.rotate.cancel(); // else `npc do` orientation doesn't work
    //       // isAnimAttached(anim.sprites, this.el.body) && anim.sprites.cancel();
    
    //       // Animate position and rotation
    //       const { translateKeyframes, rotateKeyframes, opts } = this.getWalkAnimDef();
    //       anim.translate = this.el.root.animate(translateKeyframes, opts);
    //       anim.rotate = this.el.body.animate(rotateKeyframes, opts);
    //       anim.durationMs = opts.duration;
    //       anim.initAnimScaleFactor = this.getAnimScaleFactor();

    //       // Animate spritesheet, assuming `walk` anim exists
    //       const { animLookup } = npcsMeta[this.classKey].parsed;
    //       const spriteMs = opts.duration === 0 ? 0 : this.getWalkCycleDuration(opts.duration);
    //       const firstFootLeads = Math.random() < 0.5; // TODO spriteMs needs modifying?
    //       anim.sprites = this.el.body.animate(
    //           firstFootLeads ?
    //             [
    //               { offset: 0, backgroundPosition: '0px' },
    //               { offset: 1, backgroundPosition: `${-animLookup.walk.frameCount * animLookup.walk.frameAabb.width}px` },
    //             ] :
    //             [// We assume an even number of frames
    //               { offset: 0, backgroundPosition: `${-animLookup.walk.frameCount * 1/2 * animLookup.walk.frameAabb.width}px` },
    //               { offset: 1, backgroundPosition: `${-animLookup.walk.frameCount * 3/2 * animLookup.walk.frameAabb.width}px` },
    //             ] 
    //         ,
    //         {
    //           easing: `steps(${animLookup.walk.frameCount})`,
    //           duration: spriteMs, // 🚧 ~ npcWalkAnimDurationMs
    //           iterations: Infinity,
    //           delay: opts.delay,
    //           playbackRate: opts.playbackRate,
    //         },
    //       );
    //       break;
    //     }
    //     case 'idle':
    //     case 'idle-breathe':
    //     case 'lie':
    //     case 'sit': {
    //       this.clearWayMetas();
    //       this.updateStaticBounds();
    
    //       if (this.anim.spriteSheet === 'sit') {
    //         this.obscureBySurfaces(); // Ensure feet are below surfaces
    //       } else {
    //         this.el.root.style.clipPath = 'none';
    //       }

    //       // - Maybe fixes "this.anim.translate.addEventListener is not a function"
    //       // - Maybe fixes "this.anim.rotate.cancel is not a function" on HMR
    //       this.anim.translate = new Animation();
    //       this.anim.rotate = new Animation();
          
    //       // ℹ️ relax type of keys
    //       // 🚧 npc classes should have same Object.keys(animLookup)
    //       const animLookup = /** @type {Record<string, NPC.NpcAnimMeta>} */ (npcsMeta[this.classKey].parsed.animLookup);

    //       // Always play an animation so can detect if paused
    //       this.anim.sprites = this.el.body.animate(
    //         [
    //           { offset: 0, backgroundPosition: '0px' },
    //           // Works even if frameCount is 1 because easing is `steps(1)`
    //           { offset: 1, backgroundPosition: `${-animLookup[this.anim.spriteSheet].frameCount * animLookup[this.anim.spriteSheet].frameAabb.width}px` },
    //         ], {
    //           easing: `steps(${animLookup[this.anim.spriteSheet].frameCount})`,
    //           duration: animLookup[this.anim.spriteSheet].durationMs,
    //           iterations: Infinity,
    //         },
    //       );
    //       break;
    //     }
    //     default:
    //       throw testNever(this.anim.spriteSheet, { suffix: 'create-npc.startAnimation' });
    //   }
    },
  };
}

/** @type {NPC.TweenWithPromise} */
const emptyTween = Object.assign(new TWEEN.Tween({}), {
  promise: () => Promise.resolve({}),
});

const sharedAnimData = /** @type {Record<NPC.SpineAnimName, NPC.SharedAnimData>} */ (
  {}
);

/**
 * @param {NPC.SpineAnimName} animName
 * @param {NPC.SpineAnimName} animName
 * @returns {NPC.SharedAnimData}
 */
function getSharedAnimData(animName) {
  const { headFrames, frameCount, rootDeltas, neckPositions } = spineMeta.anim[animName];
  return sharedAnimData[animName] ??= {
    animName,
    frameCount,
    bodyRects: spineMeta.anim[animName].packedRects,
    headFrames,
    neckPositions,
    rootDeltas,
    headOrientKey: spineAnimToSetup[animName].headOrientKey,
    stationaryFps: spineAnimToSetup[animName].stationaryFps,
  };
}

/**
 * 
 * @param {NPC.SharedAnimData} shared 
 * @param {number} walkSpeed
 */
function getAnimDurations(shared, walkSpeed) {
  if (shared.rootDeltas.length) {
    // rootDelta is in our world coords, where 60 ~ 1.5 meter (so 40 ~ 1 meter)
    return shared.rootDeltas.map(delta => (delta / 40) / walkSpeed);
  } else {
    return [...Array(shared.frameCount)].map(_ => 1 / shared.stationaryFps);
  }
}
