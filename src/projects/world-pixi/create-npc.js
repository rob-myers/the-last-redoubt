import { Texture, Rectangle } from "@pixi/core";
import { Sprite } from "@pixi/sprite";
import TWEEN from '@tweenjs/tween.js';

import { Poly, Rect, Vect } from '../geom';
import { testNever } from "../service/generic";
import { warn } from "../service/log";
import { npcRadius, npcClassToSpineHeadSkin, spineAnimToSetup } from "./const";

import spineMeta from "static/assets/npc/top_down_man_base/spine-meta.json";

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
      this.a.opacity.cancel();
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
      this.a.rotate.cancel();
    
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

      this.a.opacity.cancel();
      this.a.rotate.cancel();

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
    getPosition() {
      return Vect.from(this.s.body.position);
    },
    getRadius() {
      return npcRadius;
    },
    obscureBySurfaces() {
      if (!this.gmRoomId) {
        return warn(`${this.key}: cannot obscure npc outside any room`);
      }
      const { gmId, roomId } = this.gmRoomId;
      const gm = api.gmGraph.gms[gmId];
      // 🚧 use better approx e.g. angled 4-gon
      const npcBounds = this.a.staticBounds.clone().applyMatrix(gm.inverseMatrix);

      const intersection = Poly.intersect(
        (gm.roomSurfaceIds[roomId] ?? [])
          .map(id => gm.groups.obstacles[id].poly)
          .filter(x => x.rect.intersects(npcBounds)),
        [Poly.fromRect(npcBounds)],
      );
      api.doors.obscureNpc(gmId, intersection);
    },
    // ℹ️ currently NPC.SpriteSheetKey equals NPC.SpineAnimName
    // 🚧 fix "final walk frame jerk" elsewhere
    // @ts-ignore
    startAnimation(animName) {
      this.a.animName = animName;
      this.a.rotate.cancel();
      
      switch (animName) {
        case 'walk': {
          this.a.rotate.cancel(); // fix `npc do` orientation
          
          // 🚧 setAnim
          // 🚧 chained rotate tween

          break;
        }
        case 'idle':
        case 'idle-breathe':
        case 'lie':
        case 'sit': {
          this.clearWayMetas();
          this.updateStaticBounds();
          if (animName === 'sit') {// Ensure feet are below surfaces
            this.obscureBySurfaces();
          }
          this.a.rotate = emptyTween;
  
          // 🚧 setAnim
          break;
        }
        default:
          // @ts-ignore
          throw testNever(animName, { suffix: 'create-npc.startAnimation' });
      }
    },
    updateStaticBounds() {
      const pos = this.getPosition();
      const radius = this.getRadius();
      this.a.staticBounds.set(pos.x - radius, pos.y - radius, 2 * radius, 2 * radius);
    },
  };
}

/** @type {NPC.TweenExt} */
const emptyTween = Object.assign(new TWEEN.Tween({}), {
  promise: () => Promise.resolve({}),
  cancel: () => {},
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
