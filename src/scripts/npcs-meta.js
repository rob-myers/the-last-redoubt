// 🚧 remove -new suffix post-migration

/// <reference path="./deps.d.ts"/>
/**
 * Using `static/assets/npc/*` create a single JSON:
 * > `src/projects/world/npcs-meta.json`.
 * 
 * Examples:
 * ```sh
 * yarn npcs-meta
 * ```
 */
import path from 'path';
import childProcess from 'child_process';

import { keys } from '../projects/service/generic';
import { writeAsJson } from '../projects/service/file';
import { computeNpcScale, computeSpritesheetCss } from '../projects/service/npc';
import { npcClassConfig } from './npcs-config';

const outputDir = path.resolve(__dirname, '../../src/projects/world');
const outputJsonFilepath = path.resolve(outputDir, 'npcs-meta.json');

const outputJson = keys(npcClassConfig).reduce(
    /** @returns {Record<string, NPC.NpcClassJson>} */
    (agg, npcClassKey) => {
        const config = npcClassConfig[npcClassKey];
        
        const animLookup = Object.keys(config.anim).reduce((agg, animKey) => {
            const animConfig = config.anim[animKey];
            const origSheetPng = `./media/NPC/class/${npcClassKey}/${npcClassKey}--${animKey}.png`;
            // ℹ️ read png from media and infer frame width/height
            const [widthStr, heightStr] = childProcess.execSync(`identify -ping -format '%w %h' ${origSheetPng}`).toString().split(' ');
            /** Frame AABB prior to applying `rotateDeg` */
            const frameAabbOrig = {
                x: 0,
                y: 0,
                width: Number(widthStr) / animConfig.frameCount,
                height: Number(heightStr),
            };
            const frameAabb = {...frameAabbOrig};
            const rotateDeg = animConfig.rotateDeg || 0;
            if ([90, 270].includes(rotateDeg)) {// Flip width and height
                frameAabb.width = frameAabbOrig.height;
                frameAabb.height = frameAabbOrig.width;
            }

            agg[animKey] = {
                animName: animKey,
                durationMs: animConfig.durationMs,
                frameAabbOrig,
                frameAabb,
                frameCount: animConfig.frameCount,
                // ℹ️ initial forward-slash is useful for web-asset
                pathPng: `/assets/npc/${npcClassKey}/${npcClassKey}--${animKey}.png`,
                pathWebp: `/assets/npc/${npcClassKey}/${npcClassKey}--${animKey}.webp`,
                rotateDeg,
                shiftFramesBy: animConfig.shiftFramesBy,
                totalDist: animConfig.totalDist,
            };
            return agg;
        }, /** @type {NPC.ParsedNpc['animLookup']} */ ({}));

        /** @type {NPC.ParsedNpc} */
        const parsed = {
            animLookup,
            npcClassKey,
            radius: config.radius,
        };

        const scale = computeNpcScale(parsed);

        return {
            ...agg,
            [npcClassKey]: {
                css: computeSpritesheetCss(parsed),
                classKey: /** @type {NPC.NpcClassKey} */ (npcClassKey),
                parsed,
                radius: parsed.radius * scale,
                scale,
                speed: 70, // 🚧 justify + per-animation
            },
        };
    },
    /** @type {Record<string, NPC.NpcClassJson>} */ ({})
);

writeAsJson(outputJson, outputJsonFilepath);
