import React from "react";
import { Sprite, useApp } from "@pixi/react";
import { ColorMatrixFilter } from "@pixi/filter-color-matrix";
import { RenderTexture, Matrix } from "@pixi/core";
import { Graphics } from "@pixi/graphics";

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

export const colorMatrixFilter = new ColorMatrixFilter();
// colorMatrixFilter.resolution = window.devicePixelRatio;
colorMatrixFilter.resolution = 4; // ℹ️ no zoom flicker
// colorMatrixFilter.enabled = true;
colorMatrixFilter.brightness(0.18, true);
colorMatrixFilter.contrast(1.5, true);
// colorMatrixFilter.alpha = 1;
// colorMatrixFilter.hue(90, true);
// colorMatrixFilter.vintage(true);
// colorMatrixFilter.polaroid(true);
// colorMatrixFilter.kodachrome(true);


export const tempMatrix = new Matrix();
