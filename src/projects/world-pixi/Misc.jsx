import React from "react";
import PixiReact from "@pixi/react";
import { Assets } from "@pixi/assets";
import { RenderTexture, Matrix, Texture, Rectangle, Ticker } from "@pixi/core";
import { Graphics } from "@pixi/graphics";
import { Sprite } from "@pixi/sprite";

import { mapValues } from "../service/generic";
import { spineAnimToSetup } from "./const";
import { useQueryOnce } from "../hooks/use-query-utils";;
import useStateRef from "../hooks/use-state-ref";

import spineMeta from '../../../static/assets/npc/top_down_man_base/spine-meta.json';

export function Origin() {
  const app = PixiReact.useApp();
  const rt = React.useMemo(() => {
    const rt = RenderTexture.create({ width: 5, height: 5 });
    const gfx = new Graphics();
    gfx.beginFill(0xff0000).drawRect(0, 0, 5, 5).endFill();
    app.renderer.render(gfx, { renderTexture: rt });
    return rt;
  }, []);
  return <PixiReact.Sprite texture={rt} x={-2.5} y={-2.5} />;
}

export function TestSprite() {
  return (
    <PixiReact.Sprite
      x={250}
      y={250}
      scale={5}
      anchor={[0.5, 0.5]}
      interactive={true}
      image="https://s3-us-west-2.amazonaws.com/s.cdpn.io/693612/IaUrttj.png"
      pointerdown={(e) => {
        console.log("click", e);
      }}
    />
  );
}

export function TestRenderTexture() {
  const app = PixiReact.useApp();

  const rt = React.useMemo(() => {
    const rt = RenderTexture.create({ width: 400, height: 400 });
    const gfx = new Graphics();
    gfx.beginFill(0xff0000);
    gfx.drawRect(0, 0, 100, 100);
    gfx.endFill();
    app.renderer.render(gfx, { renderTexture: rt });
    return rt;
  }, []);

  return (
    <PixiReact.Sprite
      x={250}
      y={250}
      texture={rt}
    />
  );
}

/**
 * @param {{ api: import('./WorldPixi').State }} param0 
 */
export function TestNpc({ api }) {
  return useQueryOnce('test-npc', () => api.lib.loadSpine('man_01_base')).data
    ? <TestInstantiateSpine api={api} />
    : null;
}

/**
 * @param {{ api: import('./WorldPixi').State }} param0 
 */
export function TestPreRenderNpc({ api }) {

  const state = useStateRef(() => ({
    tex: api.npcs.tex,
    ticker: createTicker(),
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
      const npc = createTestNpc(def, api);
      state.pc.addChild(...Object.values(npc.sprite));
      npc.setAnim('idle');
      npc.updateSprites(); // Avoid initial flicker
      return state.npc[npc.key] = npc;
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
    const npc = state.npc.rob ?? state.spawnNpc({
      npcKey: 'rob',
      headSkinName: 'head/skin-head-dark',
      walkSpeed: 0.6,
      angle: 180,
    });
    npc.setAnim('sit');
    const { update } = state;
    state.ticker.add(update).start();
    return () => {
      state.ticker.remove(update).stop();
    };
  }, []);

  React.useEffect(() => {
    api.disabled ? state.ticker.stop() : state.ticker.start();
  }, [api.disabled]);

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
    />
  </>;
}

/**
 * @typedef TestNpcDef
 * @property {string} npcKey
 * @property {NPC.SpineHeadSkinName} headSkinName
 * @property {number} walkSpeed Meters per second
 * @property {number} [angle] Degrees
 */

/**
 * @typedef TestNpc
 * @property {string} key
 * @property {TestNpcDef} def
 * 
 * @property {TestNpcSpriteLookup} sprite
 * @property {number} speed Meters per second
 * @property {number} angle Degrees
 * @property {number} currTime
 * Normalized real-valued time of current animation.
 * Non-negative integers correspond to frames.
 * @property {TestNpcAnim} anim
 *
 * @property {() => number} getFrame
 * @property {(animName: NPC.SpineAnimName) => void} setAnim
 * @property {(pixiDelta: number) => void} updateTime
 * @property {() => void} updateSprites
 */

/**
 * @typedef TestNpcSpriteLookup
 * @property {Sprite} body
 * @property {Sprite} head
 * @property {Sprite} [bodyCircle] Debug
 */

/**
 * @typedef TestNpcAnim
 * @property {NPC.SpineAnimName} animName
 * @property {number} frameCount Total number of frames
 * @property {number} initHeadWidth
 * @property {Geom.RectJson[]} bodyRects
 * @property {import("src/scripts/service").SpineAnimMeta['headFrames']} headFrames
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
      const { animBounds, headFrames, frameCount, rootDeltas } = spineMeta.anim[animName];
      anim.bodyRects = spineMeta.anim[animName].packedRects;
      anim.headFrames = headFrames;
      anim.frameCount = frameCount;
      anim.rootDeltas = rootDeltas;
      if (rootDeltas.length) {
        // rootDelta is in our world coords, where 60 ~ 1.5 meter (so 40 ~ 1 meter)
        anim.durations = rootDeltas.map(delta => (delta / 40) / npc.def.walkSpeed);
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
      sprite.head.anchor.set(0, 0);
      
      sprite.body.scale.set(spineMeta.npcScaleFactor);
      sprite.body.angle = npc.angle;
      anim.initHeadWidth = headRect.width;

      npc.updateSprites();
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
      const { bodyRects, rootDeltas, headFrames, initHeadWidth } = npc.anim;
      const { body, head } = npc.sprite;
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
      const { x, y, angle, width } = headFrames[currFrame];
      head.angle = angle + body.angle;
      head.scale.set(width / initHeadWidth);
      head.position.set(
        body.x + Math.cos(radians) * x - Math.sin(radians) * y,
        body.y + Math.sin(radians) * x + Math.cos(radians) * y,
      );
    },
  };

  return npc;
}


const TestInstantiateSpine = PixiReact.PixiComponent('TestInstantiateSpine', {
  /** @param {{ api: import('./WorldPixi').State }} props  */
  create(props) {
    const spine = props.api.lib.instantiateSpine('man_01_base');
    // console.log(spine);
    spine.state.setAnimation(0, 'idle', false);
    // spine.state.setAnimation(0, 'lie', false);
    spine.update(0);

    const { width: frameWidth } = spine.skeleton.getBoundsRect();
    spine.scale.set((2 * 13) / frameWidth);
    spine.position.set(spine.width/2, 0);
    return spine;
  },
});

export function createTicker() {
  const ticker = new Ticker;
  ticker.autoStart = false;
  // state.ticker.minFPS = 1, state.ticker.maxFPS = 30;
  ticker.stop();
  return ticker;
}
