import React from "react";
import { Container, Sprite } from "@pixi/react";

/**
 * For Geomorphs, Doors, DebugWorld, Decor, FOV
 * @param {Props} props
 */
export default function GmSprites(props) {
  return (
    <>
      {props.gms.map((gm, gmId) => (
        <Container
          key={gmId}
          {...gm.pixiTransform}
          filters={props.filters ?? []}
        >
          <Sprite
            width={gm.pngRect.width}
            height={gm.pngRect.height}
            texture={props.tex[gmId]}
            position={{ x: gm.pngRect.x, y: gm.pngRect.y }}
          />
        </Container>
      ))}
    </>
  );
}

/**
 * @typedef Props
 * @property {Geomorph.GeomorphDataInstance[]} gms
 * @property {import('@pixi/core').RenderTexture[]} tex
 * @property {import('@pixi/core').Filter[]} [filters]
 */
