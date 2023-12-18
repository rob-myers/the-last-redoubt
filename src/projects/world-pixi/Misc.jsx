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

  const state = useStateRef(() => {
    const tex = RenderTexture.create({ width: spineMeta.packedWidth, height: spineMeta.packedHeight });
    const ticker = new Ticker;
    ticker.autoStart = false;
    ticker.stop();

    const body = new Sprite(new Texture(tex.baseTexture));
    const head = new Sprite(new Texture(tex.baseTexture));
    body.texture.frame = new Rectangle();
    head.texture.frame = new Rectangle(); // Avoid initial flicker

    return {
      /** Pre-rendered spritesheet i.e. `yarn spine-render` */
      srcTex: /** @type {import('pixi.js').Texture} */ ({}),
      /** A copy of `srcTex` possibly with debug stuff */
      tex,
      // not necessarily contiguous packedRects
      animRects: mapValues(spineMeta.anim, ({ packedRects }) => packedRects),

      /** Meters per second */
      speed: 0.3,
      /** Degrees */
      angle: 135,

      /** Animation's real-valued current time in [0, numFrames - 1] */
      currentTime: 0,
      currentFrame: 0,
      framesPerSec: 0,
      body,
      head,
      frameCount: 1,
      initHeadWidth: 0,
      bodyRects: /** @type {Geom.RectJson[]} */ ([]),
      headFrames: /** @type {import("src/scripts/service").SpineAnimMeta['headFrames']} */ ([]),
      rootDeltas: /** @type {number[]} */ ([]),
      /** Length of frames in seconds */
      durations: /** @type {number[]} */ ([]),

      /**
       * @param {NPC.SpineAnimName} animName 
       * @param {NPC.SpineHeadSkinName} headSkinName 
       */
      setAnim(animName, headSkinName) {
        state.currentFrame = 0;
        const { headOrientKey, motionlessFps } = spineAnimToSetup[animName]
        const { animBounds, headFrames, frameCount, rootDeltas } = spineMeta.anim[animName];
        state.bodyRects = state.animRects[animName];
        state.headFrames = headFrames;
        state.frameCount = frameCount;
        state.rootDeltas = rootDeltas;
        // rootDelta in our world coords, where 60 ~ 1.5 meter (so 40 ~ 1 meter)
        state.durations = rootDeltas.map(delta => (delta / 40) / state.speed);
        /**
         * - Moving animations have specific durations, ensuring feet placement and desired constant speed.
         * - Motionless animations have specified frames per seconds.
         * - Single frame animations don't need a fps.
         */
        state.framesPerSec = state.rootDeltas.length
          ? 1 / state.durations[state.currentFrame]
          : (motionlessFps ?? 0);
        
        // ℹ️ Changing frame width/height later deforms image
        const bodyRect = state.bodyRects[state.currentFrame];
        const headRect = spineMeta.head[headSkinName].packedHead[headOrientKey];
        state.body.texture.frame = new Rectangle(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
        state.head.texture.frame = new Rectangle(headRect.x, headRect.y, headRect.width, headRect.height);

        // Body anchor is (0, 0) in spine world coords
        state.body.anchor.set(Math.abs(animBounds.x) / animBounds.width, Math.abs(animBounds.y) / animBounds.height);
        state.head.anchor.set(0, 0);
        
        state.body.scale.set(npcScaleFactor);
        state.body.angle = state.angle;
        state.initHeadWidth = state.head.width;
      },
      ticker,
      /** @param {number} deltaRatio */
      updateFrame(deltaRatio, force = false) {
        const deltaSecs = deltaRatio * (1 / 60);
        const prevFrame = state.currentFrame;

        state.currentTime += (deltaSecs * state.framesPerSec);
        state.currentFrame = Math.floor(state.currentTime) % state.frameCount;
        if (state.currentFrame === prevFrame && !force) {
          return;
        }

        // body
        state.body.texture._uvs.set(/** @type {Rectangle} */ (state.bodyRects[state.currentFrame]), state.tex.baseTexture, 0);
        const radians = state.body.rotation;
        if (state.rootDeltas.length) {
          state.framesPerSec = 1 / state.durations[state.currentFrame];
          // pixi.js convention: 0 degrees ~ north ~ negative y-axis
          const rootDelta = state.rootDeltas[state.currentFrame];
          state.body.x += rootDelta * Math.sin(radians);
          state.body.y -= rootDelta * Math.cos(radians);
        }

        // head
        const { x, y, angle, width } = state.headFrames[state.currentFrame];
        state.head.angle = angle + state.body.angle;
        state.head.scale.set(width / state.initHeadWidth);
        state.head.position.set(
          state.body.x + Math.cos(radians) * x - Math.sin(radians) * y,
          state.body.y + Math.sin(radians) * x + Math.cos(radians) * y,
        );
      },
    };
  }, {
    overwrite: { angle: true, speed: true },
  });

  // load spritesheet into RenderTexture
  const query = useQueryWrap('test-pre-render-npc', async () => {
    state.srcTex = await Assets.load(`/assets/npc/top_down_man_base/spine-render/spritesheet.webp`);
    api.renderInto((new Graphics)
      .beginTextureFill({ texture: state.srcTex })
      .drawRect(0, 0, state.tex.width, state.tex.height)
      .endFill(), state.tex);
    return null;
  });

  const ready = query.isFetched && !query.isFetching;

  React.useEffect(() => {
    if (ready) {
      state.setAnim('walk', 'head/skin-head-dark');
      const { updateFrame } = state;
      updateFrame(0, true); // Avoid initial flicker
      state.ticker.add(updateFrame).start();
      return () => state.ticker.remove(updateFrame).stop();
    }
  }, [ready]);

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
