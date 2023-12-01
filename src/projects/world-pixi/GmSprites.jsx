import React from "react";
import { Sprite } from "@pixi/react";

/**
 * For Geomorphs, Doors, DebugWorld, Decor, FOV
 * @param {Props} props
 */
export default function GmSprites(props) {
  return <>
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
  </>;
}

/**
 * @typedef Props
 * @property {Geomorph.GeomorphDataInstance[]} gms
 * @property {import('@pixi/core').RenderTexture[]} tex Aligned to `gms`
 * @property {import('@pixi/core').Filter[]} [filters]
 * @property {boolean[]} [visible] Aligned to `gms`
 */
