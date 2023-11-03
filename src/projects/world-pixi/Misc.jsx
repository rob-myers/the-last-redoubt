import React from "react";
import { Sprite } from "@pixi/react";

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
