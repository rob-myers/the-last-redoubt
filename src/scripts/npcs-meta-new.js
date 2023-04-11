// 🚧 remove -new suffix post-migration

/// <reference path="./deps.d.ts"/>
/**
 * Using `static/assets/npc/*` create a single JSON:
 * > `src/projects/world/npcs-meta-new.json`.
 * 
 * Examples:
 * ```sh
 * yarn npcs-meta-new
 * ```
 */
import path from 'path';
import childProcess from 'child_process';

import { keys } from '../projects/service/generic';
import { writeAsJson } from '../projects/service/file';
import { computeNpcScale, computeSpritesheetCssNew } from '../projects/service/npc';

/**
 * Hard-coded data may be necessary.
 * - unclear how to extract "number of frames" from Spriter *.scml file.
 * - need to guess "totalDist" unless we track bones somehow...
 * - non-trivial to rotate Spriter animation when lack root bone
 * @type {Record<NPC.NpcClassKey, NPC.NpcClassConfig>}
 */
export const npcClassConfig = {
    'first-human-npc': {// Made using Synfig
        anim: {
            idle: { frameCount: 1, speed: 0, totalDist: 0, durationMs: 0 },
            'idle-breathe': { frameCount: 20, speed: 0, totalDist: 0, durationMs: 1000 },
            sit: { frameCount: 1, speed: 0, totalDist: 0, durationMs: 0 },
            walk: {
                frameCount: 10,
                speed: 70, // 🚧 justify
                totalDist: 286.65601055507693,
                durationMs: -1, // 🚧 overwritten
            },
        },
        radius: 80,
    },
    'man-base-variant': {// Made using Spriter Pro
        anim: {
            idle: { frameCount: 14, speed: 0, totalDist: 0, durationMs: 4000, rotateDeg: 90 },
            lie: { frameCount: 1, speed: 0, totalDist: 0, durationMs: 0, rotateDeg: 90 },
            sit: { frameCount: 1, speed: 0, totalDist: 0, durationMs: 0, rotateDeg: 90 },
            walk: {
                durationMs: -1, // 🚧 overwritten
                frameCount: 14,
                shiftFramesBy: -4,
                rotateDeg: 90,
                speed: 70 ,// 🚧 justify
                totalDist: 300, // 🚧 justify
            },
        },
        radius: 750 * 0.2, // Export scale is 20%
    },
};

const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const inputDir = path.resolve(staticAssetsDir, 'npc');
const outputDir = path.resolve(__dirname, '../../src/projects/world');
const outputJsonFilepath = path.resolve(outputDir, 'npcs-meta-new.json');

const outputJson = keys(npcClassConfig).reduce(
    /** @returns {Record<string, NPC.NpcMetaJsonNew>} */
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
                contacts: [], // 🚧 remove
                deltas: [], // 🚧 remove
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
        }, /** @type {NPC.ParsedNpcNew['animLookup']} */ ({}));

        /** @type {NPC.ParsedNpcNew} */
        const parsed = {
            animLookup,
            npcJsonKey: npcClassKey,
            radius: config.radius,
        };

        const scale = computeNpcScale(parsed);

        return {
            ...agg,
            [npcClassKey]: {
                css: computeSpritesheetCssNew(parsed),
                jsonKey: /** @type {NPC.NpcClassKey} */ (npcClassKey),
                parsed,
                radius: parsed.radius * scale,
                scale,
                speed: 70, // 🚧 justify + per-animation
            },
        };
    },
    /** @type {Record<string, NPC.NpcMetaJsonNew>} */ ({})
);

writeAsJson(outputJson, outputJsonFilepath);
