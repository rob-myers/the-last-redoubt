import { css } from '@emotion/css';
import firstNpcJson from '../../../public/npc/first-npc.json'

/** @type {Record<NPC.NpcJsonKey, NPC.NpcJson>} */
export const npcJson = {
  "first-npc.json": (() => {

    const parsed = firstNpcJson;
    const radiusInSvg = 40;
    const scale = 0.19;
    const radius = radiusInSvg * scale * parsed.zoom;

    /** @type {NPC.NpcJson} */
    const output = {
      parsed,
      scale,
      radiusInSvg,
      offsetRadians: 0,
      radius,
      defaultInteractRadius: radius * 3,
      speed: 70,

      css: css`
${Object.entries(parsed.animLookup).map(([animName, animMeta]) => `
  &.${animName} .body {
    width: ${animMeta.aabb.width}px;
    height: ${animMeta.aabb.height}px;
    left: ${-animMeta.aabb.width * 0.5}px;
    top: ${-animMeta.aabb.height * 0.5}px;
    background: url('/npc/first-npc--${animName}.png'); 
  }
`).join('\n\n')}`,

    };

    return output;
  })(),

};
