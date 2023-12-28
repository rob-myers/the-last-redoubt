import React from "react";
import PixiReact from "@pixi/react";
import { RenderTexture, Ticker } from "@pixi/core";
import { Graphics } from "@pixi/graphics";

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
