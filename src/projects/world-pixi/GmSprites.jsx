import React, { forwardRef } from "react";
import { Sprite, Container } from "@pixi/react";

const GmSprites = forwardRef(
  /**
   * For Geomorphs, Doors, DebugWorld, Decor, FOV
   * @param {Props} props
   */
  function GmSprites(props, ref) {
    return (
      <Container ref={ref} name={props.name ?? 'gm-sprites'}>
        {props.gms.map((gm, gmId) => (
          <Sprite
            key={gmId}
            {...gm.pixiTransform}
            filters={props.filters ?? []}
            eventMode="static"
            width={gm.pngRect.width}
            height={gm.pngRect.height}
            texture={props.tex[gmId]}
            visible={props.visible?.[gmId] ?? true}
          />
        ))}
      </Container>
    );
  }
);

export default GmSprites;


/**
 * @typedef Props
 * @property {string} [name]
 * @property {Geomorph.GeomorphDataInstance[]} gms
 * @property {import('@pixi/core').RenderTexture[]} tex Aligned to `gms`
 * @property {import('@pixi/core').Filter[]} [filters]
 * @property {boolean[]} [visible] Aligned to `gms`
 */
