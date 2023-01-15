import { css } from '@emotion/css';
import { cssName } from './const';

import firstAnimJson from '../../../static/assets/npc/first-anim/first-anim.json';

/**
 * 🚧 automatically construct this lookup as JSON via script `npc-meta`
 */

/** @type {Record<NPC.NpcJsonKey, NPC.NpcMetaJson>} */
export const npcJson = {

  'first-anim': (() => {

    const parsed = firstAnimJson;
    const offsetRadians = 0;
    const radiusInSvg = 40;
    const scale = 0.18; // 🚧 reverse engineer so scaled radius is 15
    const radius = radiusInSvg * scale * parsed.zoom; // ~15 🚧

    return {
      parsed,
      scale,
      offsetRadians,
      radius,
      speed: 70,
      css: computeSpritesheetCss(parsed, offsetRadians, scale),
    };
  })(),

};

export const defaultNpcInteractRadius = 50;

/**
 * 
 * @param {NPC.ParsedNpc} parsed 
 * @param {number} offsetRadians 
 * @param {number} scale 
 */
function computeSpritesheetCss(parsed, offsetRadians, scale) {
  return css`
    .body {
      transform: rotate(calc(${offsetRadians}rad + var(${cssName.npcLookRadians}))) scale(${scale});
    }
    
    ${Object.keys(parsed.animLookup).map((animName) => `
      &.${animName} .body {
        width: ${parsed.aabb.width}px;
        height: ${parsed.aabb.height}px;
        left: ${-parsed.aabb.width * 0.5}px;
        top: ${-parsed.aabb.height * 0.5}px;
        background: url('/assets/npc/${parsed.npcName}/${parsed.npcName}--${animName}.png');
      }
    `).join('\n\n')}
`;
}
