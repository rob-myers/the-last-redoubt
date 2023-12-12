import React from "react";
import PixiReact from "@pixi/react";
import { ColorMatrixFilter } from "@pixi/filter-color-matrix";
import { Assets } from "@pixi/assets";
import { RenderTexture, Matrix, Texture, Rectangle } from "@pixi/core";
import { Graphics } from "@pixi/graphics";
import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { TextStyle } from "@pixi/text";

import { mapValues } from "../service/generic";
import { useQueryOnce, useQueryWrap } from "../hooks/use-query-utils";;
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

export const colMatFilter1 = new ColorMatrixFilter();
// colorMatrixFilter.resolution = window.devicePixelRatio;
colMatFilter1.resolution = 4; // ℹ️ no zoom flicker
// colorMatrixFilter.enabled = true;
// colMatFilter1.polaroid(true);
colMatFilter1.brightness(0.18, true);
colMatFilter1.contrast(1.5, true);
// colMatFilter1.alpha = 1;
// colMatFilter1.hue(90, true);
// colMatFilter1.vintage(true);
// colMatFilter1.kodachrome(true);

export const colMatFilter2 = new ColorMatrixFilter();
colMatFilter2.alpha = 0.2;
// colMatFilter2.tint(0, true);
colMatFilter2.resolution = 2; // better zoom flicker

export const colMatFilter3 = new ColorMatrixFilter();
// colMatFilter3.resolution = 2; // better zoom flicker
// colMatFilter3.kodachrome(true);
colMatFilter3.brightness(0.2, true);

export const tempMatrix1 = new Matrix();

export const emptyContainer = new Container();
/** Must be cleared after use */
export const emptyGraphics = new Graphics();

export const textStyle1 = new TextStyle({
  fontFamily: 'Gill sans',
  letterSpacing: 1,
  fontSize: 8,
  // textBaseline: 'bottom',
  // fontStyle: 'italic',
  // fontWeight: 'bold',
  fill: ['#ffffff'],
  stroke: '#000000',
  strokeThickness: 2,
  dropShadow: false,
  dropShadowColor: '#000000',
  dropShadowBlur: 4,
  dropShadowAngle: Math.PI / 6,
  dropShadowDistance: 6,
  wordWrap: true,
  wordWrapWidth: 440,
  lineJoin: 'round',
});

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
    /** Pre-rendered spritesheet (`yarn spine-render`) */
    srcTex: /** @type {import('pixi.js').Texture} */ ({}),
    /** Contains `srcTex`, possibly with debug stuff */
    tex: RenderTexture.create({ width: spineMeta.packedWidth, height: spineMeta.packedHeight }),
    animRects: mapValues(spineMeta.anim, ({ animBounds, packedRect, frameCount }) =>
      [...new Array(frameCount)].map((_, frame) => ({
        x: packedRect.x + frame * (animBounds.width + spineMeta.packedPadding),
        y: packedRect.y,
        width: animBounds.width,
        height: animBounds.height,
      }))
    ),
    npcContainer: /** @type {import('pixi.js').ParticleContainer} */ ({}),
  }));

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
    if (ready) {
      /** Npc radius is 13 in our notion of "world coords" */
      const scaleFactor = (2 * 13) / spineMeta.anim.idle.animBounds.width;

      /** @type {keyof spineMeta['anim']} */
      const animName = 'idle-breathe';
      const { frameCount } = spineMeta.anim[animName]
      const rects = state.animRects[animName];

      const sprite = new Sprite();
      sprite.texture = new Texture(state.tex.baseTexture);
      // ℹ️ Changing frame width/height later deforms image
      sprite.texture.frame = new Rectangle(rects[0].x, rects[0].y, rects[0].width, rects[0].height);

      state.npcContainer.addChild(sprite);
      sprite.scale.set(scaleFactor);


      let frame = 0;
      const timeoutId = window.setInterval(() => {
        sprite.texture._uvs.set(/** @type {Rectangle} */ (rects[frame]), state.tex.baseTexture, 0);
        frame = (frame + 1) % frameCount;
      }, 100);
      return () => {
        window.clearInterval(timeoutId);
        state.npcContainer.removeChild(sprite);
      };
    }
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
