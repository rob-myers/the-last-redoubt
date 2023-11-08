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
            width={gm[props.alignTo].width}
            height={gm[props.alignTo].height}
            texture={props.tex[gmId]}
            position={props.alignTo === 'pngRect' ? { x: gm.pngRect.x, y: gm.pngRect.y } : { x: 0, y: 0 }}
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
 * @property {'pngRect' | 'gridRect'} alignTo
 * @property {import('@pixi/core').Filter[]} [filters]
 */
