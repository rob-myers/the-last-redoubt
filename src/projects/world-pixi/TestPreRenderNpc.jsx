import React from "react";
import PixiReact from "@pixi/react";
import { Sprite } from "@pixi/sprite";
import { Texture, Rectangle } from "@pixi/core";

import { spineAnimToSetup, worldUnitsPerMeter } from "./const";
import useStateRef from "../hooks/use-state-ref";

import spineMeta from 'static/assets/npc/top_down_man_base/spine-meta.json';

/**
 * @param {{ api: import('./WorldPixi').State; disabled?: boolean; }} param0 
 */
export default function TestPreRenderNpc({ api, disabled }) {

  const state = useStateRef(() => ({
    tex: api.npcs.tex,
    ticker: api.lib.createTicker(),
    pc: /** @type {import('pixi.js').ParticleContainer} */ ({}),
    npc: /** @type {{ [npcKey: string]: TestNpc }} */ ({}),

    /** @param {string} npcKey */
    removeNpc(npcKey) {
      const npc = state.npc[npcKey];
      if (npc) {
        delete state.npc[npcKey];
        state.pc.removeChild(...Object.values(npc.sprite));
      }
    },
    /** @param {TestNpcDef} def */
    spawnNpc(def) {
      let npc = state.npc[def.npcKey];
      if (!npc) {
        npc = createTestNpc(def, api);
        state.pc.addChild(...Object.values(npc.sprite));
      }
      npc.setAnim('idle');
      npc.updateSprites(); // Avoid initial flicker
      return state.npc[def.npcKey] = npc;
    },
    /** @param {number} deltaRatio */
    update(deltaRatio) {
      /** @type {TestNpc} */ let npc;
      for (const npcKey in state.npc) {
        npc = state.npc[npcKey];
        npc.anim.frameCount > 1 && npc.updateTime(deltaRatio);
      }
    },
  }));

  React.useEffect(() => {
    const npcs = [...Array(
      // 500
      5,
      // 1,
    )].map((_, i) => state.spawnNpc({
      npcKey: `rob-${i}`,
      headSkinName: 'head/skin-head-dark',
      walkSpeed: 0.6,
      angle: 180,
      x: 40 * (i % 5),
      y: 40 * Math.floor(i / 5),
    }));
    npcs.forEach(npc => npc.setAnim('walk'));
    // npcs.forEach(npc => npc.setAnim('idle-breathe'));
    // npcs.forEach(npc => npc.showBounds(true));
    npcs[0].showBounds(true);
    npcs[0].headAngle = -25;

    const { update } = state;
    state.ticker.add(update).start();
    return () => {
      state.ticker.remove(update).stop();
      npcs.forEach(npc => state.removeNpc(npc.key));
    };
  }, []);

  React.useEffect(() => {
    disabled ? state.ticker.stop() : state.ticker.start();
  }, [disabled]);

  return <>
    {/* <PixiReact.Sprite texture={state.tex} /> */}
    <PixiReact.ParticleContainer
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
      // maxSize={3000}
    />
  </>;
}

/**
 * @typedef TestNpcDef
 * @property {string} npcKey
 * @property {NPC.SpineHeadSkinName} headSkinName
 * @property {number} walkSpeed Meters per second
 * @property {number} [angle] Degrees
 * @property {number} [x]
 * @property {number} [y]
 */

/**
 * @typedef TestNpc
 * @property {string} key
 * @property {TestNpcDef} def
 * 
 * @property {TestNpcSpriteLookup} sprite
 * @property {number} speed Meters per second
 * @property {number} angle Degrees
 * @property {number} headAngle Degrees
 * @property {number} currTime
 * Normalized real-valued time of current animation.
 * Non-negative integers correspond to frames.
 * @property {TestNpcAnim} anim
 *
 * @property {() => number} getFrame
 * @property {(animName: NPC.SpineAnimName) => void} setAnim
 * @property {(shouldShow: boolean) => void} showBounds
 * @property {(pixiDelta: number) => void} updateTime
 * @property {() => void} updateSprites
 */

/**
 * @typedef TestNpcSpriteLookup
 * @property {Sprite} body
 * @property {Sprite} head
 * @property {Sprite} [bounds] Debug: circular body bounds
 */

/**
 * @typedef TestNpcAnim
 * @property {NPC.SpineAnimName} animName
 * @property {number} frameCount Total number of frames
 * @property {number} initHeadWidth
 * @property {Geom.RectJson[]} bodyRects
 * @property {import("src/scripts/service").SpineAnimMeta['headFrames']} headFrames
 * @property {Geom.VectJson[]} neckPositions
 * @property {number[]} rootDeltas
 * @property {number[]} durations
 */

/**
 * @param {TestNpcDef} def
 * @param {import('./WorldPixi').State} api
 * @returns {TestNpc}
 */
function createTestNpc(def, api) {
  const { baseTexture } = api.npcs.tex;

  /** @type {TestNpc} */
  const npc = {
    key: def.npcKey,
    def,
    speed: 0,
    angle: def.angle ?? 0,
    headAngle: 0,
    currTime: 0,
    sprite: {
      body: new Sprite(new Texture(baseTexture)),
      head: new Sprite(new Texture(baseTexture)),
      // bodyCircle: new Sprite(new Texture(baseTexture)),
    },
    anim: {// overridden via setAnim
      animName: 'idle',
      frameCount: 1,
      bodyRects: [],
      durations: [],
      headFrames: [],
      neckPositions: [],
      initHeadWidth: 0,
      rootDeltas: [],
    },
    getFrame() {
      return Math.floor(npc.currTime) % npc.anim.frameCount;
    },
    setAnim(animName) {
      const { anim, sprite } = npc;
      anim.animName = animName;
      // anim.headSkinName = headSkinName;
      npc.currTime = 0;

      const { headOrientKey, stationaryFps, numFrames } = spineAnimToSetup[animName]
      const { animBounds, headFrames, frameCount, rootDeltas, neckPositions } = spineMeta.anim[animName];
      anim.bodyRects = spineMeta.anim[animName].packedRects;
      anim.headFrames = headFrames;
      anim.neckPositions = neckPositions;
      anim.frameCount = frameCount;
      anim.rootDeltas = rootDeltas;
      if (rootDeltas.length) {
        // rootDelta is in our world coords, where 60 ~ 1.5 meter (so 40 ~ 1 meter)
        anim.durations = rootDeltas.map(delta => (delta / worldUnitsPerMeter) / npc.def.walkSpeed);
      } else {
        anim.durations = [...Array(numFrames)].map(_ => 1 / stationaryFps);
      }
      
      // ℹ️ Changing frame width/height later deforms image
      const bodyRect = anim.bodyRects[npc.currTime];
      const headRect = spineMeta.head[npc.def.headSkinName].packedHead[headOrientKey];
      sprite.body.texture.frame = new Rectangle(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
      sprite.head.texture.frame = new Rectangle(headRect.x, headRect.y, headRect.width, headRect.height);

      // Body anchor is (0, 0) in spine world coords
      sprite.body.anchor.set(Math.abs(animBounds.x) / animBounds.width, Math.abs(animBounds.y) / animBounds.height);
      // sprite.head.anchor.set(0, 0);
      sprite.head.anchor.set(
        (neckPositions[0].x - headFrames[0].x) / headFrames[0].width,
        (neckPositions[0].y - headFrames[0].y) / headFrames[0].height,
      );
      
      sprite.body.scale.set(spineMeta.npcScaleFactor);
      sprite.body.angle = npc.angle;
      anim.initHeadWidth = headRect.width;

      npc.updateSprites();
    },
    showBounds(shouldShow) {
      const { bounds } = npc.sprite;
      if (!shouldShow && bounds) {
        delete npc.sprite.bounds;
        bounds.removeFromParent();
      }
      if (shouldShow && !bounds) {
        const sprite = new Sprite(new Texture(baseTexture));
        const { packedRect } = spineMeta.extra["circular-bounds"];
        sprite.texture.frame = new Rectangle(packedRect.x, packedRect.y, packedRect.width, packedRect.height);
        sprite.scale.set(spineMeta.npcScaleFactor);
        npc.sprite.body.parent.addChild(sprite);
        sprite.anchor.set(0.5);
        sprite.tint = '#00ff00';
        sprite.alpha = 0.5;
        npc.sprite.bounds = sprite;
      }
    },
    updateTime(deltaRatio) {
      const deltaSecs = deltaRatio * (1 / 60);
      let frame = npc.getFrame(), shouldUpdate = false;

      // Could skip multiple frames in single update via low fps
      // https://github.com/pixijs/pixijs/blob/dev/packages/sprite-animated/src/AnimatedSprite.ts
      let lag = ((npc.currTime % 1) * npc.anim.durations[frame]) + deltaSecs;
      while (lag >= npc.anim.durations[frame]) {
        lag -= npc.anim.durations[frame];
        npc.currTime++;
        frame = npc.getFrame();
        shouldUpdate = true;
      }
      npc.currTime = Math.floor(npc.currTime) + lag / npc.anim.durations[frame];
      shouldUpdate && npc.updateSprites();
    },
    updateSprites() {
      const currFrame = npc.getFrame();
      const { bodyRects, rootDeltas, headFrames, initHeadWidth, neckPositions } = npc.anim;
      const { body, head, bounds: circularBounds } = npc.sprite;
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
      head.angle = angle + body.angle + npc.headAngle;
      head.scale.set(width / initHeadWidth);
      head.position.set(
        body.x + Math.cos(radians) * neckPos.x - Math.sin(radians) * neckPos.y,
        body.y + Math.sin(radians) * neckPos.x + Math.cos(radians) * neckPos.y,
      );
      // extras
      if (circularBounds) {
        circularBounds.position.copyFrom(body.position);
      }
    },
  };

  npc.sprite.body.position.set(def.x, def.y);

  return npc;
}
