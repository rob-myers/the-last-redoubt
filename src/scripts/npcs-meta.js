/// <reference path="./deps.d.ts"/>
/**
 * - Combine all NPC JSON metadata from `static/assets/npc/*`
 *   into a single JSON `src/projects/world/npcs-meta.json`.
 * - The JSONs were previously extracted via `render-npc` (once per npc)
 * 
 * Examples:
 * ```sh
 * yarn npcs-meta
 * ```
 */

import path from 'path';
import fs from 'fs';
import { writeAsJson } from '../projects/service/file';
import { computeNpcScale, computeSpritesheetCss } from '../projects/service/npc';

const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const inputDir = path.resolve(staticAssetsDir, 'npc');
const outputDir = path.resolve(__dirname, '../../src/projects/world');
const outputJsonFilepath = path.resolve(outputDir, 'npcs-meta.json');

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
                jsonKey: /** @type {NPC.NpcJsonKey} */ (folderName),
                parsed,
                scale,
                radius: parsed.radius * scale,
                speed: 70, // 🚧 justify
                css: computeSpritesheetCss(parsed, offsetRadians, scale),
            },
        };
    },
    /** @type {Record<string, NPC.NpcMetaJson>} */ ({})
);

writeAsJson(outputJson, outputJsonFilepath);
