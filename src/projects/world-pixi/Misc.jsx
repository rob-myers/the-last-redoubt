import React from "react";
import { Sprite, useApp, Container as ContainerComponent, PixiComponent  } from "@pixi/react";
import { ColorMatrixFilter } from "@pixi/filter-color-matrix";
import { RenderTexture, Matrix } from "@pixi/core";
import { Graphics } from "@pixi/graphics";
import { Container } from "@pixi/display";
import { TextStyle } from "@pixi/text";
import { useQuery } from "@tanstack/react-query";

export function Origin() {
  const app = useApp();

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
    <Sprite texture={rt} />
  );
}

export function TestSprite() {
  return (
    <Sprite
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
  const app = useApp();

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
    <Sprite
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
  const ready = useQuery({
    queryKey: ['test-npc'],
    async queryFn() {
      await api.lib.loadSpineNpc('man_01_base');
      return null;
    },
    refetchOnMount: 'always',
    gcTime: Infinity,
    staleTime: Infinity,
  }).data === null;

  return ready ? <TestInstantiateSpine api={api} /> : null;
}

const TestInstantiateSpine = PixiComponent('FromComponent', {
  /** @param {{ api: import('./WorldPixi').State }} props  */
  create(props) {
    const spine = props.api.lib.instantiateSpineNpc('man_01_base');
    spine.state.setAnimation(0, 'idle', false);
    const { width: frameWidth } = spine.skeleton.getBoundsRect();
    spine.scale.set((2 * 13) / frameWidth);
    spine.position.set(spine.width/2, 0);
    return spine;
  },
});
