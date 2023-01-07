/// <reference path="./deps.d.ts"/>
/**
 * 🚧
 * yarn npc-json {folder}
 * yarn npc-json {folder} {anim-name-0} ...
 * 
 * - {folder} relative to media/NPC should contain {folder}.sifz
 * - Examples:
 *  - yarn npc-json first-anim
 *  - yarn npc-json first-anim walk
 */

import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import xml2js from 'xml2js';
import { writeAsJson } from '../projects/service/file';
import { error } from '../projects/service/log';
import { Rect } from '../projects/geom';
// import { mapValues } from '../projects/service/generic';
// import * as npcService from '../projects/service/npc';

const [,, sifzFolder, ...animNames] = process.argv;
const sifzInputDir = path.join('media/NPC/', sifzFolder);
const sifzFilepath = path.resolve(sifzInputDir, `${sifzFolder}.sifz`);
if (!sifzFolder || !fs.existsSync(sifzFilepath)) {
    error(`usage: yarn npc-json {folder} {...anim-name-0} ... where
    - media/NPC/{folder}/{folder}.sifz exists
    `);
    process.exit(1);
}

const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const npcJsonOutputDir = path.resolve(staticAssetsDir, 'npc');
// fs.mkdirSync(npcJsonOutputDir, { recursive: true });


async function main() {
    // Obtain XML by decompressing Synfig .sifz file
    const synfigXml = zlib.unzipSync(fs.readFileSync(sifzFilepath)).toString();
    
    const parser = new xml2js.Parser();
    /** @type {{ canvas: ParsedInnerSynfig }} */
    const synfigJson = await parser.parseStringPromise(synfigXml);
    const { $: topDollar, name: [npcName], keyframe } = synfigJson.canvas;

    const totalFrameCount = parseInt(topDollar['end-time']) + 1;
    console.log({totalFrameCount})

    /** @type {NPC.ParsedNpc['animLookup']} */
    const animLookup = {};
    keyframe.forEach(({ _: animName, $: { time } }, i) => {
        animLookup[animName] = {
            animName,
            frameCount: keyframe[i + 1]
              ? parseInt(keyframe[i + 1].$.time) - parseInt(time)
              : totalFrameCount - parseInt(time),
            aabb: new Rect, // 🚧
            contacts: [], // 🚧
            deltas: [], // 🚧
            totalDist: 0, // 🚧
        };
    });

    /** @type {NPC.ParsedNpc} */
    const npcJson = {
        npcName,
        animLookup,
        zoom: 2,
    };

    writeAsJson(npcJson, path.resolve(npcJsonOutputDir, `${sifzFolder}.json`));

    // ⛔️ debug only
    // writeAsJson(synfigJson, path.resolve(npcJsonOutputDir, `${sifzFolder}.orig.json`));
}

main();

/**
 * @typedef ParsedInnerSynfig
 * @property {SynfigTopDollar} $
 * @property {string[]} name
 * @property {{ $: { name: string; content: string; } }[]} meta
 * @property {{ _: string; $: { time: string; active: string } }[]} keyframe
 * @property {{ $: SynfigLayerType; param: SynfigParam[] }[]} layer
 */

/**
 * @typedef SynfigTopDollar
 * @property {string} version
 * @property {string} width
 * @property {string} height
 * @property {string} xres
 * @property {string} yres
 * @property {string} gamma-r
 * @property {string} gamma-g
 * @property {string} gamma-b
 * @property {string} view-box
 * @property {string} antialias
 * @property {string} fps
 * @property {string} begin-time
 * @property {string} end-time
 * @property {string} bgcolor
 */

/**
 * @typedef SynfigLayerType
 * @property {'group' | 'switch'} type 
 * @property {string} active
 * @property {string} exclude_from_rendering
 * @property {string} version
 * @property {string} desc
 */

/**
 * 🚧 huge number of params?
 * @typedef SynfigParam
 * @property {{ name: string; }} $
 * @property {{ $: { value: string; } }[]} [real]
 * @property {{ $: { value: string; static?: string; } }[]} [integer]
 */
