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
import { computeNpcScale, computeSpritesheetCss, computeSpritesheetCssNew } from '../projects/service/npc';

const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const inputDir = path.resolve(staticAssetsDir, 'npc');
const outputDir = path.resolve(__dirname, '../../src/projects/world');
const outputJsonFilepath = path.resolve(outputDir, 'npcs-meta-new.json');

/**
 * @type {Record<NPC.NpcClassKey, {
 *  anim: Record<string, { frameCount: number; speed: number; totalDist: number; }>;
 *  radius: number;
 *  offsetDegrees: number;
 * }>}
 * Hard-coded data may be necessary.
 * e.g. unclear how to extract "number of frames" from Spriter *.scml file.
 * e.g. guess "totalDist", unless we track bones somehow...
 */
const npcClassConfig = {
    'man-base-variant': {
        anim: {
            // 🚧 generate spritesheets
            // idle: { frameCount: 15, speed: 0, totalDist: 0 },
            // lie: { frameCount: 1, speed: 0, totalDist: 0 },
            // sit: { frameCount: 1, speed: 0, totalDist: 0 },
            walk: { frameCount: 15, speed: 70 /** 🚧 */, totalDist: 300 },
        },
        radius: 650 * 0.2, // Export scale is 20%
        offsetDegrees: 270, // -90
    },
};


const outputJson = keys(npcClassConfig).reduce(
    /** @returns {Record<string, NPC.NpcMetaJsonNew>} */
    (agg, npcClassKey) => {
        const config = npcClassConfig[npcClassKey];
        
        const animLookup = Object.keys(config.anim).reduce((agg, animKey) => {
            const animConfig = config.anim[animKey];
            // 🚧 We removed leading / (which was web-asset-specific)
            const pathPng = `assets/npc/${npcClassKey}/${npcClassKey}--${animKey}.png`;
            const pathWebp = `assets/npc/${npcClassKey}/${npcClassKey}--${animKey}.webp`;
            // 🚧 read png and infer frame width/height
            const [widthStr, heightStr] = childProcess.execSync(`identify -ping -format '%w %h' ./static/${pathPng}`).toString().split(' ');
            agg[animKey] = {
                aabb: {
                    x: 0,
                    y: 0,
                    width: Number(widthStr) / animConfig.frameCount,
                    height: Number(heightStr),
                },
                animName: animKey,
                contacts: [], // 🚧 remove
                deltas: [], // 🚧 remove
                totalDist: animConfig.totalDist,
                frameCount: animConfig.frameCount,
                pathPng,
                pathWebp,
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
        /** Non-trivial to rotate Spriter e.g. lack root bone */
        const offsetRadians = config.offsetDegrees;

        return {
            ...agg,
            [npcClassKey]: {
                jsonKey: /** @type {NPC.NpcClassKey} */ (npcClassKey),
                parsed,
                scale,
                radius: parsed.radius * scale,
                speed: 70, // 🚧 justify + per-animation
                css: computeSpritesheetCssNew(parsed, offsetRadians, scale),
            },
        };
    },
    /** @type {Record<string, NPC.NpcMetaJsonNew>} */ ({})
);

writeAsJson(outputJson, outputJsonFilepath);
