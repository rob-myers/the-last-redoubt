/// <reference path="./deps.d.ts"/>
/**
 * 🚧
 * yarn npc-json {folder}
 * yarn npc-json {folder} {anim-name-0} ...
 * 
 * - {folder} relative to media/NPC should contain {folder}.sifz
 * - Examples:
 *  - yarn npc-json first-anim
 *  - yarn npc-json first-anim walk 🚧
 */

import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import xml2js from 'xml2js';
import { writeAsJson } from '../projects/service/file';
import { error, warn } from '../projects/service/log';
import { Rect, Vect } from '../projects/geom';
import { assertDefined } from '../projects/service/generic';
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

const zoom = 2;
const baseAabb = new Rect(0, 0, 128, 128);

async function main() {
    // Obtain XML by decompressing Synfig .sifz file
    const synfigXml = zlib.unzipSync(fs.readFileSync(sifzFilepath)).toString();
    
    const parser = new xml2js.Parser();
    /** @type {{ canvas: ParsedInnerSynfig }} */
    const synfigJson = await parser.parseStringPromise(synfigXml);
    const { $: topDollar, name: [npcName], keyframe, layer } = synfigJson.canvas;

    const totalFrameCount = parseInt(topDollar['end-time']) + 1;

    // Internal coords will be relative to this "space"
    const viewBoxCoords = topDollar['view-box'].split(' ').map(Number);
    const viewTopLeft = new Vect(viewBoxCoords[0], viewBoxCoords[1]);
    const viewBottomRight = new Vect(viewBoxCoords[2], viewBoxCoords[3]);

    const contactsLayer = layer.find(x => x.$.desc === 'ContactPoints');
    if (!contactsLayer) {
      warn(`${sifzInputDir}: ContactPoints layer not found )`);
    }

    /** @type {NPC.ParsedNpc['animLookup']} */
    const animLookup = {};
    keyframe.forEach(({ _: animName, $: { time } }, i) => {

      if (contactsLayer) {// Contact points
        const canvas = assertDefined(contactsLayer.param.find(x => x.$.name === 'canvas')?.canvas?.[0]);
        const leftLayer = canvas.layer.find(x => x.$.desc === 'LeftContact');
        const rightLayer = canvas.layer.find(x => x.$.desc === 'RightContact');

        const leftWay = {
          topLeft: leftLayer?.param.find(x => x.$.name === 'point1')?.animated?.[0].waypoint,
          bottomRight: leftLayer?.param.find(x => x.$.name === 'point2')?.animated?.[0].waypoint,
        };
        const rightWay = {
          topLeft: rightLayer?.param.find(x => x.$.name === 'point1')?.animated?.[0].waypoint,
          bottomRight: rightLayer?.param.find(x => x.$.name === 'point2')?.animated?.[0].waypoint,
        };

        // 🚧
        console.log({
          leftWay,
          rightWay,
        });
      }

      animLookup[animName] = {
          animName,
          frameCount: keyframe[i + 1]
            ? parseInt(keyframe[i + 1].$.time) - parseInt(time)
            : totalFrameCount - parseInt(time),
          aabb: baseAabb.clone().scale(zoom).json,

          contacts: [], // 🚧
          deltas: [], // 🚧
          totalDist: 0, // 🚧
      };
  });

    /** @type {NPC.ParsedNpc} */
    const npcJson = {
        npcName,
        animLookup,
        zoom,
    };

    writeAsJson(npcJson, path.resolve(npcJsonOutputDir, `${sifzFolder}.json`));

    // ⛔️ debug only
    writeAsJson(synfigJson, path.resolve(npcJsonOutputDir, `${sifzFolder}.orig.json`));
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
 * @property {Pick<ParsedInnerSynfig, 'layer'>[]} [canvas]
 * @property {SynfigAnimParam[]} [animated]
 */

/**
 * @typedef SynfigAnimParam
 * @property {{ type: 'vector' }} $
 * @property {{ $: { time: string; before: string; after: string }; vector: { $: { guid: string; }; x: string[]; y: string[] }[] }[]} waypoint
 */