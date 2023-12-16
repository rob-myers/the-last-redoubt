import React from "react";
import PixiReact from "@pixi/react";
import { Assets } from "@pixi/assets";
import { RenderTexture, Matrix, Texture, Rectangle, Ticker } from "@pixi/core";
import { Graphics } from "@pixi/graphics";
import { Sprite } from "@pixi/sprite";

import { mapValues } from "../service/generic";
import { spineAnimToHeadOrient } from "./const";
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

    return {
      /** Pre-rendered spritesheet i.e. `yarn spine-render` */
      srcTex: /** @type {import('pixi.js').Texture} */ ({}),
      /** A copy of `srcTex` possibly with debug stuff */
      tex,
      /** Given anim and 0-based frame, bounding rect in spritesheet  */
      animRects: mapValues(spineMeta.anim, ({ animBounds, packedRect, frameCount }) =>
        [...new Array(frameCount)].map((_, frame) => ({
          x: packedRect.x + frame * (animBounds.width + spineMeta.packedPadding),
          y: packedRect.y,
          width: animBounds.width,
          height: animBounds.height,
        }))
      ),
      npcContainer: /** @type {import('pixi.js').ParticleContainer} */ ({}),

      /** Animation's real-valued current time in [0, numFrames - 1] */
      currentTime: 0,
      currentFrame: 0,
      body: new Sprite(new Texture(tex.baseTexture)),
      head: new Sprite(new Texture(tex.baseTexture)),
      framesPerSec: 0.5,
      frameCount: 1,
      initHeadWidth: 0,
      bodyRects: /** @type {Geom.RectJson[]} */ ([]),
      headFrames: /** @type {import("src/scripts/service").SpineAnimMeta['headFrames']} */ ([]),

      /**
       * @param {NPC.SpineAnimName} animName 
       * @param {NPC.SpineHeadSkinName} headSkinName 
       */
      setAnim(animName, headSkinName) {
        const orient = spineAnimToHeadOrient[animName]
        const { animBounds, headFrames, frameCount } = spineMeta.anim[animName];
        const bodyRects = state.bodyRects = state.animRects[animName];
        state.headFrames = headFrames;
        const headRect = spineMeta.head[headSkinName].packedHead[orient];
        state.frameCount = frameCount;

        // ℹ️ Changing frame width/height later deforms image
        state.body.texture.frame = new Rectangle(bodyRects[0].x, bodyRects[0].y, bodyRects[0].width, bodyRects[0].height);
        state.head.texture.frame = new Rectangle(headRect.x, headRect.y, headRect.width, headRect.height);

        // Body anchor is (0, 0) in spine world coords
        state.body.anchor.set(Math.abs(animBounds.x) / animBounds.width, Math.abs(animBounds.y) / animBounds.height);
        state.head.anchor.set(0, 0);
        
        state.body.scale.set(npcScaleFactor);
        state.initHeadWidth = state.head.width;

        state.body.angle = 45;
      },
      ticker,
      /** @param {number} deltaSecs */
      updateFrame(deltaSecs) {
        state.currentTime += (deltaSecs * state.framesPerSec);
        state.currentFrame = Math.floor(state.currentTime) % state.frameCount;
        // body
        state.body.texture._uvs.set(/** @type {Rectangle} */ (state.bodyRects[state.currentFrame]), state.tex.baseTexture, 0);
        // head
        const { x, y, angle, width } = state.headFrames[state.currentFrame];
        state.head.angle = angle + state.body.angle;
        state.head.scale.set(width / state.initHeadWidth);

        const radians = state.body.rotation;
        state.head.position.set(
          Math.cos(radians) * x - Math.sin(radians) * y,
          Math.sin(radians) * x + Math.cos(radians) * y,
        );
      },
    };
  });

  const query = useQueryWrap('test-pre-render-npc', async () => {
    // copy spritesheet into a RenderTexture
    state.srcTex = await Assets.load(
      `/assets/npc/top_down_man_base/spine-render/spritesheet.webp`
    );
    api.renderInto((new Graphics)
      .beginTextureFill({ texture: state.srcTex })
      .drawRect(0, 0, state.tex.width, state.tex.height)
      .endFill(), state.tex);
    return null;
  });

  const ready = query.isFetched && !query.isFetching;

  React.useEffect(() => {
    if (!ready) return;

    state.setAnim('idle-breathe', 'head/blonde-light');
    const { updateFrame } = state;
    updateFrame(0); // Avoid initial flicker
    state.ticker.add(updateFrame).start();
    return () => {
      state.ticker.stop();
      state.ticker.remove(updateFrame);
    };
  }, [ready]);

  return <>
    {/* <PixiReact.Sprite texture={state.tex} /> */}
    <PixiReact.ParticleContainer
      ref={x => {
        if (x) {
          state.npcContainer = x;
          x.addChild(state.body, state.head);
        }
      }}
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
