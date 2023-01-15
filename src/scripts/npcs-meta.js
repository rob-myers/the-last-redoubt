/// <reference path="./deps.d.ts"/>
/**
 * - Combine all NPC JSON metadata from static/assets/npc/*
 *   into a single JSON static/assets/npc/npcs-meta.json.
 * - This data was previously extracted per-npc via `render-npc` 
 * 
 * yarn npcs-meta
 */

import path from 'path';
import fs from 'fs';
import { writeAsJson } from '../projects/service/file';
import { computeNpcScale, computeSpritesheetCss } from '../projects/service/npc';

const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const inputDir = path.resolve(staticAssetsDir, 'npc');
const outputJsonFilepath = path.resolve(inputDir, 'npcs-meta.json');

/** Those directories "foo" containing a file "foo.json" */
const animDirs = fs
    .readdirSync(inputDir, { withFileTypes: true })
    .filter(x =>
        x.isDirectory()
        && fs.readdirSync(path.join(inputDir, x.name)).includes(`${x.name}.json`)
    )
;

const outputJson = animDirs.reduce(
    /** @returns {Record<string, NPC.NpcMetaJson>} */
    (agg, { name: folderName }) => {
        const inputJsonPath = path.resolve(inputDir, folderName, `${folderName}.json`);
        const parsed = /** @type {NPC.ParsedNpc} */ (JSON.parse(fs.readFileSync(inputJsonPath).toString()));
        const scale = computeNpcScale(parsed);
        const offsetRadians = 0; // 🚧 needed?
        return {
            ...agg,
            [folderName]: {
                parsed,
                scale,
                offsetRadians,
                radius: parsed.radius,
                speed: 70, // 🚧 justify
                css: computeSpritesheetCss(parsed, offsetRadians, scale),
            },
        };
    },
    /** @type {Record<string, NPC.NpcMetaJson>} */ ({})
);

writeAsJson(outputJson, outputJsonFilepath);
