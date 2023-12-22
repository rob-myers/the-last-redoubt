import React from "react";
import PixiReact from "@pixi/react";
import { Assets } from "@pixi/assets";
import { RenderTexture, Matrix, Texture, Rectangle, Ticker } from "@pixi/core";
import { Graphics } from "@pixi/graphics";
import { Sprite } from "@pixi/sprite";

import { mapValues } from "../service/generic";
import { spineAnimToSetup } from "./const";
import { useQueryOnce, useQueryWrap } from "../hooks/use-query-utils";;
import useStateRef from "../hooks/use-state-ref";

import spineMeta from '../../../static/assets/npc/top_down_man_base/spine-meta.json';
/** Npc radius is 13 in our notion of "world coords" */
const npcScaleFactor = (2 * 13) / spineMeta.anim.idle.animBounds.width;

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
    // not necessarily contiguous packedRects
    animRects: mapValues(spineMeta.anim, ({ packedRects }) => packedRects),

    /** Meters per second */
    speed: 0.5,
    /** Degrees */
    angle: 180,

    /** Animation's normalized real-valued current time i.e. 0 ≤ t < numFrames - 1 */
    currTime: 0,
    body: new Sprite(new Texture(api.npcs.tex.baseTexture)),
    head: new Sprite(new Texture(api.npcs.tex.baseTexture)),
    frameCount: 1,
    initHeadWidth: 0,
    bodyRects: /** @type {Geom.RectJson[]} */ ([]),
    headFrames: /** @type {import("src/scripts/service").SpineAnimMeta['headFrames']} */ ([]),
    /** Only non-empty for animations with motion e.g. `walk` */
    rootDeltas: /** @type {number[]} */ ([]),
    /** Duration of each frame in seconds */
    durations: /** @type {number[]} */ ([]),

    getFrame() {
      return Math.floor(state.currTime) % state.frameCount;
    },
    /**
     * @param {NPC.SpineAnimName} animName 
     * @param {NPC.SpineHeadSkinName} headSkinName 
     */
    setAnim(animName, headSkinName) {
      state.currTime = 0;
      const { headOrientKey, stationaryFps, numFrames } = spineAnimToSetup[animName]
      const { animBounds, headFrames, frameCount, rootDeltas } = spineMeta.anim[animName];
      state.bodyRects = state.animRects[animName];
      state.headFrames = headFrames;
      state.frameCount = frameCount;
      state.rootDeltas = rootDeltas;
      if (rootDeltas.length) {
        // rootDelta is in our world coords, where 60 ~ 1.5 meter (so 40 ~ 1 meter)
        state.durations = rootDeltas.map(delta => (delta / 40) / state.speed);
      } else {
        state.durations = [...Array(numFrames)].map(_ => 1 / stationaryFps);
      }
      
      // ℹ️ Changing frame width/height later deforms image
      const bodyRect = state.bodyRects[state.currTime];
      const headRect = spineMeta.head[headSkinName].packedHead[headOrientKey];
      state.body.texture.frame = new Rectangle(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
      state.head.texture.frame = new Rectangle(headRect.x, headRect.y, headRect.width, headRect.height);

      // Body anchor is (0, 0) in spine world coords
      state.body.anchor.set(Math.abs(animBounds.x) / animBounds.width, Math.abs(animBounds.y) / animBounds.height);
      state.head.anchor.set(0, 0);
      
      state.body.scale.set(npcScaleFactor);
      state.body.angle = state.angle;
      state.head.scale.set(1);
      state.initHeadWidth = state.head.width;
    },
    /** @param {number} deltaRatio */
    updateFrame(deltaRatio) {
      const deltaSecs = deltaRatio * (1 / 60);
      let frame = state.getFrame(), shouldUpdate = false;

      // Could skip multiple frames in single update via low fps
      // https://github.com/pixijs/pixijs/blob/dev/packages/sprite-animated/src/AnimatedSprite.ts
      let lag = ((state.currTime % 1) * state.durations[frame]) + deltaSecs;
      while (lag >= state.durations[frame]) {
        lag -= state.durations[frame];
        state.currTime++;
        frame = state.getFrame();
        shouldUpdate = true;
      }
      state.currTime = Math.floor(state.currTime) + lag / state.durations[frame];
      shouldUpdate && state.updateSprites();
    },
    updateSprites() {
      const currFrame = state.getFrame();
      // body
      state.body.texture._uvs.set(/** @type {Rectangle} */ (state.bodyRects[currFrame]), state.tex.baseTexture, 0);
      const radians = state.body.rotation;
      if (state.rootDeltas.length) {
        // pixi.js convention: 0 degrees ~ north ~ negative y-axis
        const rootDelta = state.rootDeltas[currFrame];
        state.body.x += rootDelta * Math.sin(radians);
        state.body.y -= rootDelta * Math.cos(radians);
      }
      // head
      const { x, y, angle, width } = state.headFrames[currFrame];
      state.head.angle = angle + state.body.angle;
      state.head.scale.set(width / state.initHeadWidth);
      state.head.position.set(
        state.body.x + Math.cos(radians) * x - Math.sin(radians) * y,
        state.body.y + Math.sin(radians) * x + Math.cos(radians) * y,
      );
    },
  }), {
    overwrite: { angle: true, speed: true },
  });

  // console.log(api.disabled);

  React.useEffect(() => {
    state.setAnim('walk', 'head/skin-head-dark');
    state.updateSprites(); // Avoid initial flicker
    if (state.frameCount > 1) {
      // ℹ️ updateFrame cannot handle infinite durations (1-frame animations)
      const { updateFrame } = state;
      state.ticker.add(updateFrame).start();
      return () => state.ticker.remove(updateFrame).stop();
    }
  }, []);

  return <>
    {/* <PixiReact.Sprite texture={state.tex} /> */}
    <PixiReact.ParticleContainer
      ref={x => x?.addChild(state.body, state.head)}
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
