import React from "react";
import PixiReact from "@pixi/react";
import { ColorMatrixFilter } from "@pixi/filter-color-matrix";
import { RenderTexture, Matrix, Texture, Rectangle } from "@pixi/core";
import { Graphics } from "@pixi/graphics";
import { Container } from "@pixi/display";
import { Sprite } from "@pixi/sprite";
import { TextStyle } from "@pixi/text";
// import { BoundingBoxAttachment } from "@pixi-spine/runtime-4.1";
import { pause } from "../service/generic";
import { useQueryOnce, useQueryWrap } from "../hooks/use-query-utils";
// import { Rect, Vect } from "../geom";
import useStateRef from "projects/hooks/use-state-ref";

export function Origin() {
  const app = PixiReact.useApp();

  const rt = React.useMemo(() => {
    const rt = RenderTexture.create({ width: 10, height: 10 });
    const gfx = new Graphics();
    gfx.beginFill(0xff0000);
    gfx.drawRect(-5, -5, 10, 10);
    gfx.endFill();
    app.renderer.render(gfx, { renderTexture: rt });
    return rt;
  }, []);

  return (
    <PixiReact.Sprite texture={rt} />
  );
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
    /** Spritesheet */
    tex: RenderTexture.create({ width: 1, height: 1 }),
    pc: /** @type {import('pixi.js').ParticleContainer} */ ({}),
    meta: /** @type {import("src/scripts/spine-meta").SpineMeta} */ ({}),
  }));

  const query = useQueryWrap('test-pre-render-npc', async () => {
    const { data } = await api.lib.loadSpine('man_01_base');
    const spine = api.lib.instantiateSpine('man_01_base');
    spine.autoUpdate = false;
    spine.state.setAnimation(0, 'idle', false);
    spine.update(0);

    /** @type {import("src/scripts/spine-meta").SpineMeta} */
    state.meta = await fetch('/assets/npc/top_down_man_base/spine-meta.json').then(x => x.json());
    const { packedWidth, packedHeight, packedPadding, anim: animMeta } = state.meta;

    state.tex.resize(packedWidth, packedHeight, true);
    
    // 👇 Debug Rectangle Packing
    // const gfx = (new Graphics).lineStyle({ width: 1 });
    // gfx.beginFill(0xffffff, 1).drawRect(0, 0, meta.packedWidth, meta.packedHeight).endFill();
    // Object.values(meta.anim).forEach(({ animName, packedRect, animBounds, frameCount }) => {
    //   gfx.beginFill(0xff0000, 0).drawRect(packedRect.x, packedRect.y, packedRect.width, packedRect.height).endFill();
    //   for (let i = 0; i < frameCount; i++)
    //     gfx.beginFill(0, 0).drawRect(packedRect.x + (i * (animBounds.width + meta.packedPadding)), packedRect.y, animBounds.width, animBounds.height);
    // });
    // api.renderInto(gfx, tex);

    for (const anim of data.animations) {
      const { frameCount, frameDuration, animBounds, packedRect } = animMeta[anim.name];
      spine.state.setAnimation(0, anim.name, false);
      for (let frame = 0; frame < frameCount; frame++) {
        spine.update(frame === 0 ? 0 : frameDuration);
        // `animBounds` where root attachment is at `(0, 0)`.
        /**
         * `animBounds` for frame `frame` is at:
         * - packedRect.x + frame * (animBounds.width + meta.packedPadding)
         * - packedRect.y
         * - animBounds.width
         * - animBounds.height
         */
        spine.position.set(
          packedRect.x + (frame * (animBounds.width + packedPadding)) + Math.abs(animBounds.x),
          packedRect.y + Math.abs(animBounds.y),
        );
        api.renderInto(spine, state.tex, false);
        await pause(30);
      }
    }

    return null;
  });

  const ready = query.isFetched && !query.isFetching;

  React.useEffect(() => {
    if (ready) {
      const sprite = new Sprite();
      sprite.texture = new Texture(state.tex.baseTexture);
      sprite.texture.frame = new Rectangle(2, 0, 165, 106);
      state.pc.addChild(sprite);
      let i = 0;
      const timeoutId = window.setInterval(() => {
        const x = 2 + (165 + 2) * (i >= 20 ? i = 0 : i++);
        sprite.texture.frame = new Rectangle(x, 0, 165, 106);
        sprite.texture.updateUvs();
      }, 100);
      return () => {
        window.clearInterval(timeoutId);
        state.pc.removeChild(sprite);
      };
    }
  }, [ready]);

  return <>
    {/* <PixiReact.Sprite texture={state.tex} /> */}
    <PixiReact.ParticleContainer
      ref={x => x && (state.pc = x)}
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
