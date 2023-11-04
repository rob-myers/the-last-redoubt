import React from "react";
import { Sprite } from "@pixi/react";
// import { BlurFilter } from "@pixi/filter-blur";
import { ColorMatrixFilter } from "@pixi/filter-color-matrix";

export function TestScene() {
  return (
    <Sprite
      x={250}
      y={250}
      anchor={[0.5, 0.5]}
      interactive={true}
      image="https://s3-us-west-2.amazonaws.com/s.cdpn.io/693612/IaUrttj.png"
      pointerdown={(e) => {
        console.log("click", e);
      }}
    />
  );
}

export const colorMatrixFilter = new ColorMatrixFilter();
// colorMatrixFilter.resolution = window.devicePixelRatio;
colorMatrixFilter.resolution = 4; // ℹ️ no zoom flicker
// colorMatrixFilter.enabled = true;
colorMatrixFilter.brightness(0.3, true);
colorMatrixFilter.contrast(1.7, true);
// colorMatrixFilter.alpha = 1;
// colorMatrixFilter.hue(90, true);
// colorMatrixFilter.vintage(true);
// colorMatrixFilter.polaroid(true);
// colorMatrixFilter.kodachrome(true);