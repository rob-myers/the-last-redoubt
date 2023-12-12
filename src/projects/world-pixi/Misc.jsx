import React from "react";
import PixiReact from "@pixi/react";
import { Assets } from "@pixi/assets";
import { RenderTexture, Matrix, Texture, Rectangle, Ticker } from "@pixi/core";
import { Graphics } from "@pixi/graphics";
import { Sprite } from "@pixi/sprite";

import { mapValues } from "../service/generic";
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
    const ticker = new Ticker;
    ticker.autoStart = false;
    ticker.stop();
    return {
      /** Pre-rendered spritesheet i.e. `yarn spine-render` */
      srcTex: /** @type {import('pixi.js').Texture} */ ({}),
      /** `srcTex`, possibly with debug stuff */
      tex: RenderTexture.create({ width: spineMeta.packedWidth, height: spineMeta.packedHeight }),
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
      ticker,
    };
  });

  const query = useQueryWrap('test-pre-render-npc', async () => {
    // copy spritesheet into a RenderTexture
    state.srcTex = await Assets.load(
      `/assets/npc/top_down_man_base/spine-render/spritesheet.webp`
    );
    const gfx = (new Graphics)
      .beginTextureFill({ texture: state.srcTex })
      .drawRect(0, 0, state.tex.width, state.tex.height)
      .endFill();
    api.renderInto(gfx, state.tex);

    // const { data } = await api.lib.loadSpine('man_01_base');
    // const spine = api.lib.instantiateSpine('man_01_base');
    // spine.autoUpdate = false;
    // spine.state.setAnimation(0, 'idle', false);
    // spine.update(0);
    return null;
  });

  const ready = query.isFetched && !query.isFetching;

  React.useEffect(() => {
    if (!ready) {
      return;
    }
    /** @type {keyof spineMeta['anim']} */
    const animName = 'walk';
    const rects = state.animRects[animName];
    
    const { frameCount, animBounds } = spineMeta.anim[animName];
    const framesPerSec = 0.5;
    /** Animation's current time in R[0, numFrames - 1] */
    let currentTime = 0, currentFrame = 0;

    const sprite = new Sprite(new Texture(state.tex.baseTexture));
    // ℹ️ Changing frame width/height later deforms image
    sprite.texture.frame = new Rectangle(rects[0].x, rects[0].y, rects[0].width, rects[0].height);
    // Set (0, 0) in `animBounds` as origin
    sprite.anchor.set(-animBounds.x / animBounds.width, -animBounds.y / animBounds.height);
    sprite.scale.set(npcScaleFactor);
    state.npcContainer.addChild(sprite);
    
    /** @param {number} deltaSecs */
    function updateFrame(deltaSecs) {
      currentTime += (deltaSecs * framesPerSec);
      currentFrame = Math.floor(currentTime) % frameCount;
      sprite.texture._uvs.set(/** @type {Rectangle} */ (rects[currentFrame]), state.tex.baseTexture, 0);
    }

    state.ticker.add(updateFrame);
    state.ticker.start();
    return () => {
      state.ticker.stop();
      state.ticker.remove(updateFrame);
      state.npcContainer.removeChild(sprite);
    };
  }, [ready]);

  return <>
    {/* <PixiReact.Sprite texture={state.tex} /> */}
    <PixiReact.ParticleContainer
      ref={x => x && (state.npcContainer = x)}
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
