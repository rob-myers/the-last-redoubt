/**
 * - Extract an NPC's JSON metadata and render its sprite-sheets,
 *   using the single input file:
 *   > media/NPC/{folder}/{folder}.sifz
 *
 * - We output files:
 *   - static/assets/npc/{folder}/{folder}.json
 *   - static/assets/npc/{folder}/{folder}--{animName}.png
 * 
 * yarn render-npc {folder} [--json]
 * 
 * - {folder} relative to media/NPC should contain {folder}.sifz
 * - option --json only writes json
 *
 * - Examples:
 *  - yarn render-npc first-human-npc
 *  - yarn render-npc first-human-npc --json
 */
/// <reference path="./deps.d.ts"/>

import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import childProcess from 'child_process';
import xml2js from 'xml2js';
import util from 'util';
import getOpts from 'getopts';

import { writeAsJson } from '../projects/service/file';
import { error, warn, info } from '../projects/service/log';
import { Rect, Vect } from '../projects/geom';
import { assertDefined, pause } from '../projects/service/generic';

const [,, sifzFolder, ...animNames] = process.argv;
const sifzInputDir = path.join('media/NPC/', sifzFolder);
const sifzFilepath = path.resolve(sifzInputDir, `${sifzFolder}.sifz`);
if (!sifzFolder || !fs.existsSync(sifzFilepath)) {
    error(`usage: yarn render-npc {folder} {...anim-name-0} ... where
    - media/NPC/{folder}/{folder}.sifz exists
    `);
    process.exit(1);
}

const opts = getOpts(process.argv);
const [
  onlyWriteJson,
] = [opts.json];

const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const outputDir = path.resolve(staticAssetsDir, 'npc', sifzFolder);
fs.mkdirSync(outputDir, { recursive: true }); // Ensure output dir
const outputJsonPath = path.resolve(outputDir, `${sifzFolder}.json`);
const outputDebugJsonPath = path.resolve(outputDir, `${sifzFolder}.orig.json`);

const zoom = 2;

main();

async function main() {
    // Obtain XML by decompressing Synfig .sifz file
    const synfigXml = zlib.unzipSync(fs.readFileSync(sifzFilepath)).toString();
    
    const parser = new xml2js.Parser();
    /** @type {{ canvas: ParsedInnerSynfig }} */
    const synfigJson = await parser.parseStringPromise(synfigXml);

    //#region DEBUG ONLY ⛔️
    // writeAsJson(synfigJson, outputDebugJsonPath);
    //#endregion


    const { $: topDollar, name: [_unusedName], desc: [metaJsonString], keyframe, layer } = synfigJson.canvas;

    const fps = parseInt(topDollar.fps);
    /** @type {NPC.NpcSynfigMetaJson} */
    const synfigMeta = metaJsonString ? JSON.parse(metaJsonString) : { keyframeToMeta: {} };
    /**
     * end-time can be e.g. `5f` or `1s 7f`
     */
    const totalFrameCount = synfigTimeToFrame(topDollar['end-time'], fps);

    // Synfig coords are relative to its "view box"
    const viewBoxCoords = topDollar['view-box'].split(' ').map(Number);
    const viewTL = new Vect(viewBoxCoords[0], viewBoxCoords[1]); // top left
    const viewBR = new Vect(viewBoxCoords[2], viewBoxCoords[3]); // bottom right
    const viewAabb = new Rect(viewTL.x, viewTL.y, viewBR.x - viewTL.x, Math.abs(viewBR.y - viewTL.y));
    const renderAabb = (
      new Rect(0, 0, Number(topDollar.width), Number(topDollar.height))
    ).scale(zoom);

    //#region Meta group contains global data
    const metaLayer = layer.find(x => x.$.desc === 'Meta');
    if (!metaLayer) { error(`Expected top-level group: Meta`); process.exit(1); }
    const metaLayerCanvas = assertDefined(metaLayer.param.find(x => x.$.name === 'canvas')?.canvas?.[0]);

    /**
     * 🚧 support animLookup[*].aabb
     * - ✅ get top-level aabb from render bounds
     * - ✅ animate aabb per keyframe
     * - 🚧 store as animLookup[*].aabb
     * - integrate into npc.staticBounds
     */
    // Meta > Aaab
    const aabbLayer = metaLayerCanvas.layer.find(x => x.$.desc === 'Aabb');
    if (!aabbLayer) { error(`Expected layer: Meta > Aaab`); process.exit(1); }
    const extractedAaabLayer = extractRectLayer(aabbLayer, viewAabb, renderAabb, fps);
    
    // Meta > BoundsCircle
    const circleLayer = metaLayerCanvas.layer.find(x => x.$.desc === 'BoundsCircle');
    if (!circleLayer) { error(`Expected layer: Meta > BoundsCircle`); process.exit(1); }
    const { real: npcRadiusZoomed } = assertDefined(extractCircleLayer(circleLayer, viewAabb, renderAabb, fps)[0].radius);

    // Meta > ContactPoints
    const contactsLayer = metaLayerCanvas.layer.find(x => x.$.desc === 'ContactPoints');
    if (!contactsLayer) {
      warn(`${sifzInputDir}: ContactPoints layer not found`);
    }
    //#endregion

    /** @param {{ $: SynfigLayerType; param: SynfigParam[] }} contactsLayer */
    function computeLayerWays(contactsLayer) {
      const canvas = assertDefined(contactsLayer.param.find(x => x.$.name === 'canvas')?.canvas?.[0]);
      const leftLayer = assertDefined(canvas.layer.find(x => x.$.desc === 'LeftContact'));
      const rightLayer = assertDefined(canvas.layer.find(x => x.$.desc === 'RightContact'));
      return [leftLayer, rightLayer].map(layer => extractRectLayer(layer, viewAabb, renderAabb, fps));
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
      /** 1-based frames */
      const frames = [...Array(frameCount)].map((_, i) => startFrame + i);

      const aabbDef = extractedAaabLayer.find(x => x.frame === startFrame);
      if (!aabbDef) {
        warn(`${sifzInputDir}: ${animName}: Aabb keyframe not found (using 1st)`);
      }
      const aabb = aabbDef
        ? Rect.fromPoints(aabbDef.topLeft.point, aabbDef.bottomRight.point)
        : Rect.fromPoints(extractedAaabLayer[0].topLeft.point, extractedAaabLayer[0].bottomRight.point)
      ;
      aabb.integerOrds();

      let contacts = /** @type {{ left: Geom.Vect | undefined; right: Geom.Vect | undefined; }[]} */ ([]);
      let deltas = /** @type {number[]} */ ([]);

      if (layerWays) {// Contact points

        const [lContacts, rContacts] = layerWays.map(layerWay => frames.map(frame => {
          // Find meta with largest meta.frame s.t. meta.frame ≤ frame 
          const found = layerWay.find((x, i, xs) =>
            x.topLeft.frame <= frame && (!xs[i + 1] || (xs[i + 1].topLeft.frame > frame))
          );
          // ℹ️ Empty rectangle understood as absence of point
          // ℹ️ Non-empty rectangle provides point via its center
          return (found && !Vect.from(found.topLeft.point).equals(found.bottomRight.point))
            ? Rect.fromPoints(found.topLeft.point, found.bottomRight.point).center
            : undefined;
        }));

        // console.log(util.inspect(lContacts, undefined, 8));
        // console.log(util.inspect(rContacts, undefined, 8));

        // Expect either all {}'s or all non-empty
        const frameContacts = frames.map((_, i) => ({ left: lContacts[i], right: rContacts[i] }));

        const numContacts = frameContacts.reduce((sum, x) => sum + ((x.left || x.right) ? 1 : 0), 0);
        if (numContacts >= 2) {
          contacts = frameContacts;
          // One more than frame count i.e. distances travelled from last -> first
          deltas = contacts.concat(contacts[0]).map(({ left: leftFoot, right: rightFoot }, i) => {
            const [prevLeft, prevRight] = [contacts[i - 1]?.left, contacts[i - 1]?.right];
            return (// For walk, exactly one of 1st two summands should be non-zero
              (!leftFoot || !prevLeft ? 0 : Math.abs(leftFoot.x - prevLeft.x)) ||
              (!rightFoot || !prevRight ? 0 : Math.abs(rightFoot.x - prevRight.x)) || 0
            );
          });
        }

      }

      animLookup[animName] = {
          animName,
          aabb,
          frameCount,
          contacts,
          deltas,
          totalDist: deltas.reduce((sum, x) => sum + x, 0),
          pathPng: `/assets/npc/${sifzFolder}/${sifzFolder}--${animName}.png`,
          pathWebp: `/assets/npc/${sifzFolder}/${sifzFolder}--${animName}.webp`,
        };
      });
      
      /** @type {NPC.ParsedNpc} */
      const npcJson = {
        npcJsonKey: /** @type {NPC.NpcJsonKey} */ (sifzFolder),
        animLookup,
        // Root aabb is render bounds (already zoomed)
        aabb: renderAabb.json,
        synfigMeta,
        radius: npcRadiusZoomed,
        zoom,
      };

    writeAsJson(npcJson, outputJsonPath);
    info(`Wrote ${outputJsonPath}`);

    if (onlyWriteJson) {
      info('Skipped rendering');
      process.exit(0);
    }

    /**
     * ========================
     * 🖋 Render spritesheet(s) 
     * ========================
     * 
     * Requires Synfig CLI:
     * - install `brew install synfig`
     * - example `synfig first-human-npc.sifz -t png-spritesheet -w 256 -h 256 -q 3 -a 1 --begin-time 0f --end-time 2f -o first-human-npc--walk.png`
     */
    /** @type {{ key: string; proc: childProcess.ChildProcessWithoutNullStreams}[]} */
    const procs = [];
    for (const [i, { _: animName, $: { time } }] of keyframe.entries()) {
      
      const frameCount = keyframe[i + 1]
        ? parseInt(keyframe[i + 1].$.time) - parseInt(time)
        : totalFrameCount - parseInt(time)
      ;
      /** 0-based frame */
      const startFrame = parseInt(time);
      const endFrame = startFrame + (frameCount - 1);
      
      info(`Rendering ${animName}...`, {startFrame, endFrame});

      /**
       * Remove existing file, because png-spritesheet won't overwrite
       * due to 'add into an existing file' param (not available in CLI?)
       * Files should be versioned, so won't matter if delete.
       */
      const outputPngPath = path.resolve(outputDir, `${sifzFolder}--${animName}.png`);
      fs.rmSync(outputPngPath, { force: true });

      procs.push({
        key: animName,
        proc: childProcess.spawn('synfig', [
          sifzFilepath,
          '-t', 'png-spritesheet',
          '-w', '256', // 🚧 hard-coded?
          '-h', '256',
          '-q', '3',
          '-a', '1',
          '--begin-time', `${startFrame}f`,
          '--end-time', `${endFrame}f`,
          '-o', outputPngPath,
        ]),
      });
    }

    // Render animations in parallel
    await Promise.all(procs.map(({ key, proc }) => {
      proc.stdout.on('data', (data) => console.log(`${key}: ${data.toString().replace(/\n/g, '; ')}`));
      return /** @type {Promise<void>} */ (
        new Promise(resolve => proc.on('exit', () => resolve()))
      );
    }));

    await pause(1000); // Needed?

    // Optimize PNGs + provide WEBP
    await /** @type {Promise<void>} */ (new Promise(resolve => {
      const proc = childProcess.spawn(`yarn`, ['minify-pngs', outputDir, 'webp']);
      proc.stdout.on('data', (data) => console.log({ key: 'minify-pngs' }, data.toString()));
      proc.stdout.on('exit', () => resolve());
    }));

}

/**
 * @typedef ParsedInnerSynfig
 * @property {SynfigTopDollar} $
 * @property {string[]} name
 * @property {string[]} desc
 * @property {{ $: { name: string; content: string; } }[]} meta
 * @property {{ _: string; $: { time: string; active: string } }[]} keyframe
 * @property {SynfigLayer[]} layer
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
 * @typedef SynfigLayer
 * @property {SynfigLayerType} $ 
 * @property {SynfigParam[]} param
 */

/**
 * 🚧 huge number of params?
 * @typedef SynfigParam
 * @property {{ name: string; }} $
 * @property {SynfigReal[]} [real]
 * @property {{ $: { value: string; static?: string; } }[]} [integer]
 * @property {Pick<ParsedInnerSynfig, 'layer'>[]} [canvas]
 * @property {SynfigAnimParamVector[] | SynfigAnimParamReal[]} [animated]
 * @property {SynfigVector[]} [vector]
 */

/**
 * @typedef SynfigAnimParamVector
 * @property {{ type: 'vector' }} $
 * @property {SynfigWayPointVector[]} waypoint
 */

/**
 * @typedef SynfigAnimParamReal
 * @property {{ type: 'real' }} $
 * @property {SynfigWayPointReal[]} waypoint
 */

/**
 * @typedef SynfigWayPointVector
 * @property {{ time: string; before: string; after: string }} $
 * @property {({ $: { guid: string; }; } & SynfigVector)[]} vector
 */

/**
 * @typedef SynfigWayPointReal
 * @property {{ time: string; before: string; after: string }} $
 * @property {({ $: { guid: string; }; } & SynfigReal)[]} real
 */

/**
 * @typedef SynfigVector
 * @property {string[]} x
 * @property {string[]} y
 */

/**
 * @typedef SynfigReal
 * @property {{ value: string; }} $
 */

/**
 * Synfig stores Rect layers as a seq of topLefts and a seq of botRights.
 * We also handle the case where it is not animated, returning a singleton.
 * @param {SynfigLayer} rectLayer
 * @param {Geom.Rect} viewAabb
 * @param {Geom.Rect} renderAabb
 * @param {number} fps
 */
function extractRectLayer(rectLayer, viewAabb, renderAabb, fps) {
  const animated = rectLayer.param.find(x => x.$.name === 'point1')?.animated;
  if (animated) {
    const topLefts = rectLayer.param.find(x => x.$.name === 'point1')?.animated?.[0].waypoint?.map(x => wayPointVectorMap(/** @type {SynfigWayPointVector} */ (x), viewAabb, renderAabb, fps))??[];
    const bottomRights = rectLayer.param.find(x => x.$.name === 'point2')?.animated?.[0].waypoint?.map(x => wayPointVectorMap(/** @type {SynfigWayPointVector} */ (x), viewAabb, renderAabb, fps))??[];
    return topLefts.map((topLeft, i) => ({
      frame: topLeft.frame, // Assume topLeft[i].frame === bottomRight[i].frame
      topLeft,
      bottomRight: bottomRights[i],
    }));
  } else {
    const tl = vectorMap(assertDefined(rectLayer.param.find(x => x.$.name === 'point1')?.vector?.[0]), viewAabb, renderAabb);
    const br = vectorMap(assertDefined(rectLayer.param.find(x => x.$.name === 'point2')?.vector?.[0]), viewAabb, renderAabb);
    return [{
      frame: 1,
      topLeft: { frame: 1, origPoint: tl.origPoint, point: tl.point },
      bottomRight: { frame: 1, origPoint: br.origPoint, point: br.point },
    }];
  }
}

/**
 * We also handle the case where it is not animated, returning a singleton.
 * @param {SynfigLayer} circleLayer
 * @param {Geom.Rect} viewAabb
 * @param {Geom.Rect} renderAabb
 * @param {number} fps
*/
function extractCircleLayer(circleLayer, viewAabb, renderAabb, fps) {
  // Only one of radius/origin might be animated
  const animatedOrigin = circleLayer.param.find(x => x.$.name === 'origin')?.animated;
  const origins = animatedOrigin
    ? circleLayer.param.find(x => x.$.name === 'origin')?.animated?.[0].waypoint?.map(x => wayPointVectorMap(/** @type {SynfigWayPointVector} */ (x), viewAabb, renderAabb, fps))??[]
    : [{
        frame: 1,
        ...vectorMap(assertDefined(circleLayer.param.find(x => x.$.name === 'origin')?.vector?.[0]), viewAabb, renderAabb),
      }];
  
  const animatedRadius = circleLayer.param.find(x => x.$.name === 'radius')?.animated;
  const radii = animatedRadius
    ? circleLayer.param.find(x => x.$.name === 'radius')?.animated?.[0].waypoint?.map(x => wayPointRealMap(/** @type {SynfigWayPointReal} */ (x), viewAabb, renderAabb, fps))??[]
    : [{
        frame: 1,
        ...realMap(assertDefined(circleLayer.param.find(x => x.$.name === 'radius')?.real?.[0]), viewAabb, renderAabb),
      }];

  // Origin and radius may be animated independently i.e. not aligned
  /**
   * @typedef OutputItem
   * @property {number} frame
   * @property {typeof origins[*]} [origin]
   * @property {typeof radii[*]} [radius]
   */
  const byFrame = /** @type {(typeof origins[0] | typeof radii[0])[]} */ ([]).concat(
    origins, radii,
  ).reduce(
    (agg, item) => {
      agg[item.frame] = {
        ...agg[item.frame],
        ...'point' in item ? { origin: item } : { radius: item },
      };
      return agg;
    },
    /** @type {Record<number, OutputItem>} */ ({})
  );
  return Object.keys(byFrame).map(Number).sort().map(x => byFrame[x]);
}

/**
 * @param {SynfigWayPointVector} wp 
 * @param {Geom.Rect} viewAabb 
 * @param {Geom.Rect} renderAabb 
 * @param {number} fps 
 */
function wayPointVectorMap(wp, viewAabb, renderAabb, fps) {
  const { $: { time }, vector: [vector] } = wp;
  const { origPoint, point } = vectorMap(vector, viewAabb, renderAabb);
  return {
    // frame: Math.round(parseFloat(time) * fps) + 1,
    /** 1-based */
    frame: synfigTimeToFrame(time, fps),
    origPoint,
    point,
  };
}

/**
 * @param {SynfigWayPointReal} wp 
 * @param {Geom.Rect} viewAabb 
 * @param {Geom.Rect} renderAabb 
 * @param {number} fps 
 */
function wayPointRealMap(wp, viewAabb, renderAabb, fps) {
  const { $: { time }, real: reals } = wp;
  const { origReal, real } = realMap(reals[0], viewAabb, renderAabb);
  return {
    /** 1-based */
    frame: Math.round(parseFloat(time) * fps) + 1,
    origReal,
    real,
  };
}

/**
 * 
 * @param {SynfigVector} p 
 * @param {Geom.Rect} viewAabb 
 * @param {Geom.Rect} renderAabb 
 */
function vectorMap(p, viewAabb, renderAabb) {
  const origPoint = new Vect(Number(p.x[0]), Number(p.y[0])); 
  return {
    origPoint,
    point: synfigCoordToRenderCoord(origPoint, viewAabb, renderAabb),
  };
}

/**
 * @param {SynfigReal} p 
 * @param {Geom.Rect} viewAabb 
 * @param {Geom.Rect} renderAabb 
 */
function realMap(p, viewAabb, renderAabb) {
  const origReal = Number(p.$.value);
  return {
    origReal,
    // Assume uniform scale i.e. could have using height
    real: origReal * (renderAabb.width / viewAabb.width),
  };
}

/**
 * @param {Geom.VectJson} input 
 * @param {Geom.Rect} viewAabb 
 * @param {Geom.Rect} renderAabb 
 */
function synfigCoordToRenderCoord(input, viewAabb, renderAabb) {
  return {
    x: ((input.x - viewAabb.x) / viewAabb.width) * renderAabb.width,
    // Synfig y+ points upwards
    y: ((viewAabb.y - input.y) / viewAabb.height) * renderAabb.height,
  };
}

/**
 * Outputs 1-based frame (unlike synfig which has 0-based frames).
 * @param {string} timeRep e.g. `5f` or `1s 7f`
 * @param {number} fps frames per second
 */
function synfigTimeToFrame(timeRep, fps) {
  return timeRep.split(' ').map(x =>
    x.endsWith('s')
      ? Math.round(fps * parseFloat(x))
      : parseInt(x)
  ).reduce((agg, item) => agg + item, 0) + 1
}