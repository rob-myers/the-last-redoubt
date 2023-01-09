/// <reference path="./deps.d.ts"/>
/**
 * - Extra metadata as JSON
 *   > static/assets/npc/{folder}/{folder}.json
 * - Renders NPC spritesheets
 *   > static/assets/npc/{folder}/{folder}--{animName}.png
 * 
 * yarn render-npc {folder}
 * yarn render-npc {folder} {anim-name-0} ... 🚧
 * 
 * - {folder} relative to media/NPC should contain {folder}.sifz
 * - Examples:
 *  - yarn render-npc first-anim
 *  - yarn render-npc first-anim walk
 */

import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import childProcess from 'child_process';
import xml2js from 'xml2js';
// import util from 'util';

import { writeAsJson } from '../projects/service/file';
import { error, warn } from '../projects/service/log';
import { Rect, Vect } from '../projects/geom';
import { assertDefined } from '../projects/service/generic';

const [,, sifzFolder, ...animNames] = process.argv;
const sifzInputDir = path.join('media/NPC/', sifzFolder);
const sifzFilepath = path.resolve(sifzInputDir, `${sifzFolder}.sifz`);
if (!sifzFolder || !fs.existsSync(sifzFilepath)) {
    error(`usage: yarn render-npc {folder} {...anim-name-0} ... where
    - media/NPC/{folder}/{folder}.sifz exists
    `);
    process.exit(1);
}

const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const outputFilesDir = path.resolve(staticAssetsDir, 'npc', sifzFolder);
const repoRootDir = path.resolve(__dirname, '../..');
fs.mkdirSync(outputFilesDir, { recursive: true }); // Ensure output dir

const baseAabb = new Rect(0, 0, 128, 128);
const zoom = 2;

async function main() {
    // Obtain XML by decompressing Synfig .sifz file
    const synfigXml = zlib.unzipSync(fs.readFileSync(sifzFilepath)).toString();
    
    const parser = new xml2js.Parser();
    /** @type {{ canvas: ParsedInnerSynfig }} */
    const synfigJson = await parser.parseStringPromise(synfigXml);
    const { $: topDollar, name: [npcName], keyframe, layer } = synfigJson.canvas;

    const totalFrameCount = parseInt(topDollar['end-time']) + 1;
    const fps = parseInt(topDollar.fps);

    // Synfig coords are relative to its "view box"
    const viewBoxCoords = topDollar['view-box'].split(' ').map(Number);
    const viewTL = new Vect(viewBoxCoords[0], viewBoxCoords[1]); // top left
    const viewBR = new Vect(viewBoxCoords[2], viewBoxCoords[3]); // bottom right
    const viewAabb = new Rect(viewTL.x, viewTL.y, viewBR.x - viewTL.x, Math.abs(viewBR.y - viewTL.y));
    const renderAabb = baseAabb.clone().scale(zoom);

    const contactsLayer = layer.find(x => x.$.desc === 'ContactPoints');
    if (!contactsLayer) {
      warn(`${sifzInputDir}: ContactPoints layer not found )`);
    }

    /** @param {Geom.VectJson} input */
    function synfigCoordToRenderCoord(input) {
      return {
        x: ((input.x - viewAabb.x) / viewAabb.width) * renderAabb.width,
        // Synfig y+ points upwards
        y: ((viewAabb.y - input.y) / viewAabb.height) * renderAabb.height,
      };
    }
    /** @param {SynfigWayPoint} wp */
    function wayPointMap(wp) {
      const { $: { time }, vector: [vector] } = wp;
      const origPoint = new Vect(Number(vector.x[0]), Number(vector.y[0])); 
      return {
        /** 1-based */
        frame: Math.round(parseFloat(time) * fps) + 1,
        origPoint,
        point: synfigCoordToRenderCoord(origPoint),
      };
    }

    /** @param {{ $: SynfigLayerType; param: SynfigParam[] }} contactsLayer */
    function computeLayerWays(contactsLayer) {

      const canvas = assertDefined(contactsLayer.param.find(x => x.$.name === 'canvas')?.canvas?.[0]);
      const leftLayer = canvas.layer.find(x => x.$.desc === 'LeftContact');
      const rightLayer = canvas.layer.find(x => x.$.desc === 'RightContact');
  
      // Synfig stores Rect layers as a seq of topLefts and a seq of botRights
      return [leftLayer, rightLayer].map(layer => ({
        topLeft: layer?.param.find(x => x.$.name === 'point1')?.animated?.[0].waypoint?.map(wayPointMap),
        bottomRight: layer?.param.find(x => x.$.name === 'point2')?.animated?.[0].waypoint?.map(wayPointMap),
      }));
    }
    const layerWays = contactsLayer ? computeLayerWays(contactsLayer) : undefined;

    /**
     * Compute animation lookup, using `keyframe` to partition frames.
     * @type {NPC.ParsedNpc['animLookup']}
     */
    const animLookup = {};
    keyframe.forEach(({ _: animName, $: { time } }, i) => {

      const frameCount = keyframe[i + 1]
        ? parseInt(keyframe[i + 1].$.time) - parseInt(time)
        : totalFrameCount - parseInt(time)
      ;
      const startFrame = parseInt(time) + 1;
      const frames = [...Array(frameCount)].map((_, i) => startFrame + i);

      const contacts = /** @type {{ left: Vect | undefined; right: Vect | undefined; }[]} */ ([]);
      let deltas = /** @type {number[]} */ ([]);

      if (layerWays) {// Contact points

        const [lContacts, rContacts] = layerWays.map(layerWay => frames.map(frame => {
          // 🚧 are we restricting to subframe range?
          // Find meta with largest meta.frame ≤ frame 
          const tl = layerWay.topLeft?.find((x, i, xs) => x.frame <= frame && (!xs[i + 1] || (xs[i + 1].frame > frame)));
          const br = layerWay.bottomRight?.find((x, i, xs) => x.frame <= frame && (!xs[i + 1] || (xs[i + 1].frame > frame)));

          // Empty rectangle understand as absence of point
          return (tl && br && !Vect.from(tl.point).equals(br.point))
            // Non-empty rectangle provides point via its center
            ? Rect.fromPoints(tl.point, br.point).center
            : undefined;
        }));

        // console.log(util.inspect(lContacts, undefined, 8));
        // console.log(util.inspect(rContacts, undefined, 8));

        // No contacts produces [{}] i.e. empty singleton
        frames.forEach((_, i) => contacts[i] = { left: lContacts[i], right: rContacts[i] });

        /** One more than frame count i.e. distances travelled from last -> first */
        deltas = contacts.concat(contacts[0]).map(({ left: leftFoot, right: rightFoot }, i) => {
          const [prevLeft, prevRight] = [contacts[i - 1]?.left, contacts[i - 1]?.right];
          return (// For walk, exactly one of 1st two summands should be non-zero
            (!leftFoot || !prevLeft ? 0 : Math.abs(leftFoot.x - prevLeft.x)) ||
            (!rightFoot || !prevRight ? 0 : Math.abs(rightFoot.x - prevRight.x)) || 0
          );
        });
      }

      animLookup[animName] = {
          animName,
          frameCount,
          aabb: renderAabb.json,

          contacts,
          deltas,
          totalDist: deltas.reduce((sum, x) => sum + x, 0),
      };
  });

    /** @type {NPC.ParsedNpc} */
    const npcJson = {
        npcName,
        animLookup,
        zoom,
    };

    writeAsJson(npcJson, path.resolve(outputFilesDir, `${sifzFolder}.json`));

    // ⛔️ debug only
    // writeAsJson(synfigJson, path.resolve(npcJsonOutputDir, `${sifzFolder}.orig.json`));

    /**
     * Render spritesheet(s) using Synfig CLI (`brew install synfig`)
     */
    // synfig first-anim.sifz -t png-spritesheet -w 256 -h 256 -q 1 -a 3 --begin-time 0f --end-time 2f -o first-anim--walk.png

    // 🚧 per animation
    const proc = childProcess.spawn('synfig', [
      sifzFilepath,
      '-t', 'png-spritesheet',
      '-w', '256', // 🚧 hard-coded?
      '-h', '256',
      '-q', '1',
      '-a', '3',
      '--begin-time', '0f', // 🚧
      '--end-time', '3f', // 🚧
      '-o', path.resolve(outputFilesDir, `${sifzFolder}--${'anim-name-here'}.png`),
    ], { cwd: repoRootDir });
    // const proc = childProcess.spawn('synfig', ['--help']);
    proc.stdout.on('data', (data) => console.log(data.toString()));

    await /** @type {Promise<void>} */ (
      new Promise(resolve => proc.on('exit', () => resolve()))
    );
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
 * @property {SynfigWayPoint[]} waypoint
 */

/**
 * @typedef SynfigWayPoint
 * @property {{ time: string; before: string; after: string }} $
 * @property {{ $: { guid: string; }; x: string[]; y: string[] }[]} vector
 */