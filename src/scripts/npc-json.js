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
import { writeAsJson } from '../projects/service/file';
import { error } from '../projects/service/log';
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
const npcJsonOutputDir = path.resolve(staticAssetsDir, 'npc', sifzFolder);
fs.mkdirSync(npcJsonOutputDir, { recursive: true });

import xml2js from 'xml2js';
const parser = new xml2js.Parser();

async function main() {
    // Obtain XML by decompressing Synfig .sifz file
    const xml = zlib.unzipSync(fs.readFileSync(sifzFilepath)).toString();

    const parsed = await parser.parseStringPromise(xml);
    const serializable = parsed;
    writeAsJson(serializable, path.resolve(npcJsonOutputDir, `${sifzFolder}.json`));
}

main();
