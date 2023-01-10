import { css } from '@emotion/css';
import { cssName } from './const';

import firstNpcJson from '../../../static/assets/npc/first-npc.json'; // 🚧 remove
import firstAnimJson from '../../../static/assets/npc/first-anim/first-anim.json';

/** @type {Record<NPC.NpcJsonKey, NPC.NpcJson>} */
export const npcJson = {

  // 🚧 remove
  'first-npc': (() => {

    const parsed = firstNpcJson;
    const offsetRadians = 0;
    const radiusInSvg = 40;
    const scale = 0.19;
    const radius = radiusInSvg * scale * parsed.zoom; // ~15

    /** @type {NPC.NpcJson} */
    const output = {
      parsed,
      scale,
      radiusInSvg,
      offsetRadians,
      radius,
      defaultInteractRadius: radius * 3,
      speed: 70,
      /** npc scale is 0.19, npc radius ~ 15, and (1/0.19) * 15 ~ 75 */
      css: computeSpritesheetCss(parsed, offsetRadians, scale),
    };

    return output;
  })(),

  'first-anim': (() => {

    const parsed = firstAnimJson;
    const offsetRadians = 0;
    const radiusInSvg = 40; // 🚧
    const scale = 0.18; // 🚧
    const radius = radiusInSvg * scale * parsed.zoom; // ~15 🚧

    return {
      parsed,
      scale,
      radiusInSvg,
      offsetRadians,
      radius,
      defaultInteractRadius: radius * 3,
      speed: 70,
      css: computeSpritesheetCssNew(parsed, offsetRadians, scale),
    };
  })(),

};

export const defaultNpcInteractRadius = 50;

/**
 * 🚧 remove
 * @param {NPC.ParsedNpc} parsed 
 * @param {number} offsetRadians 
 * @param {number} scale 
 */
function computeSpritesheetCss(parsed, offsetRadians, scale) {
  return css`

    .body {
      transform: rotate(calc(${offsetRadians}rad + var(${cssName.npcLookRadians}))) scale(${scale});
    }
    
    ${Object.entries(parsed.animLookup).map(([animName, animMeta]) => `
      &.${animName} .body {
        width: ${animMeta.aabb.width}px;
        height: ${animMeta.aabb.height}px;
        left: ${-animMeta.aabb.width * 0.5}px;
        top: ${-animMeta.aabb.height * 0.5}px;
        background: url('/assets/npc/${parsed.npcName}--${animName}.png');
      }
    `).join('\n\n')}

`;
}

/**
 * 
 * @param {NPC.ParsedNpc} parsed 
 * @param {number} offsetRadians 
 * @param {number} scale 
 */
function computeSpritesheetCssNew(parsed, offsetRadians, scale) {
  return css`
    .body {
      transform: rotate(calc(${offsetRadians}rad + var(${cssName.npcLookRadians}))) scale(${scale});
    }
    
    ${Object.entries(parsed.animLookup).map(([animName, animMeta]) => `
      &.${animName} .body {
        width: ${animMeta.aabb.width}px;
        height: ${animMeta.aabb.height}px;
        left: ${-animMeta.aabb.width * 0.5}px;
        top: ${-animMeta.aabb.height * 0.5}px;
        background: url('/assets/npc/${parsed.npcName}/${parsed.npcName}--${animName}.png');
      }
    `).join('\n\n')}
`;
}
