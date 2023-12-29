// @ts-nocheck
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
 * @returns {NPC.NPC}
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
      time: 0,
      neckAngle: 0,
      
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
    canLook() {
      return (this.a.animName === 'idle' ||
        this.a.animName === 'idle-breathe') && !this.doMeta;
    },
    changeClass(npcClassKey) {// we don't trigger render
      this.classKey = npcClassKey;
    },
    clearWayMetas() {
      this.a.wayMetas.length = 0;
      this.a.prevWayMetas.length = 0;
      window.clearTimeout(this.a.wayTimeoutId);
    },

    getAngle() {
      return this.s.body.rotation;
    },
    getFrame() {
      return Math.floor(this.a.time) % this.a.shared.frameCount;
    },
    getPosition() {
      return Vect.from(this.s.body.position);
    },
    getRadius() {
      return npcRadius;
    },
    getSpeed() {
      return this.def.walkSpeed * this.anim.speedFactor;
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
    setupAnim(animName) {
      const { a, s } = this;
      a.animName = animName;
      a.time = 0;

      const { headOrientKey } = spineAnimToSetup[animName]
      const { animBounds, headFrames, neckPositions } = spineMeta.anim[animName];
      
      a.shared = getSharedAnimData(animName);
      a.durations = getAnimDurations(a.shared, this.getSpeed());

      // Changing frame width/height later deforms image
      const bodyRect = a.shared.bodyRects[a.time];
      const headRect = spineMeta.head[headSkinName].packedHead[headOrientKey];
      s.body.texture.frame = new Rectangle(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
      s.head.texture.frame = new Rectangle(headRect.x, headRect.y, headRect.width, headRect.height);

      // Body anchor is (0, 0) in spine world coords
      s.body.anchor.set(Math.abs(animBounds.x) / animBounds.width, Math.abs(animBounds.y) / animBounds.height);
      // Head anchor is neck position
      s.head.anchor.set(
        (neckPositions[0].x - headFrames[0].x) / headFrames[0].width,
        (neckPositions[0].y - headFrames[0].y) / headFrames[0].height,
      );
      
      s.body.scale.set(spineMeta.npcScaleFactor);
      s.body.angle = this.getAngle();
      a.initHeadWidth = headRect.width;

      this.updateSprites();
    },
    // ℹ️ currently NPC.SpriteSheetKey equals NPC.SpineAnimName
    // 🚧 fix "final walk frame jerk" elsewhere
    startAnimation(animName) {
      this.a.animName = animName;
      this.a.rotate.cancel();
      
      switch (animName) {
        case 'walk': {
          this.a.rotate.cancel(); // fix `npc do` orientation
          this.setupAnim(animName);
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
          this.setupAnim(animName);
          break;
        }
        default:
          throw testNever(animName, { suffix: 'create-npc.startAnimation' });
      }
    },
    updateSprites() {
      const currFrame = this.getFrame();
      const { bodyRects, rootDeltas, headFrames, neckPositions } = this.a.shared;
      const { body, head, bounds: circularBounds } = this.s;

      // body
      body.texture._uvs.set(
        /** @type {Rectangle} */ (bodyRects[currFrame]),
        baseTexture,
        0,
      );
      const radians = body.rotation;
      if (rootDeltas.length) {
        // pixi.js convention: 0 degrees ~ north ~ negative y-axis
        const rootDelta = rootDeltas[currFrame];
        body.x += rootDelta * Math.sin(radians);
        body.y -= rootDelta * Math.cos(radians);
      }
      // head
      const { angle, width } = headFrames[currFrame];
      const neckPos = neckPositions[currFrame];
      head.angle = angle + body.angle + this.a.neckAngle;
      head.scale.set(width / this.a.initHeadWidth);
      head.position.set(
        body.x + Math.cos(radians) * neckPos.x - Math.sin(radians) * neckPos.y,
        body.y + Math.sin(radians) * neckPos.x + Math.cos(radians) * neckPos.y,
      );
      // extras
      if (circularBounds) {
        circularBounds.position.copyFrom(body.position);
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
