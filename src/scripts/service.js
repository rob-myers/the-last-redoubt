/// <reference path="./deps.d.ts"/>
import childProcess from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from "chalk";

import { TextureAtlas } from "@pixi-spine/base";
import {
  AtlasAttachmentLoader,
  SkeletonJson,
  Spine,
  BoundingBoxAttachment,
  RegionAttachment,
} from "@pixi-spine/runtime-4.1";
import { Assets } from "@pixi/node";

import { Poly, Rect, Vect } from "../projects/geom";
import { assertDefined } from "../projects/service/generic";
import { skeletonScale } from '../projects/world/const';

export const repoRoot = path.resolve(__dirname, "../..");
export const npcAssetsFolder = path.resolve(repoRoot, `static/assets/npc`);

/**
 * @param {string} scriptName
 * @param {string[]} args
 */
export async function runYarnScript(scriptName, ...args) {
    await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
        const proc = childProcess.spawn('yarn', [scriptName, ...args]);
        proc.stdout.on('data', (data) => console.log(chalk.greenBright(scriptName), data.toString()));
        // stderr needn't contain error messages
        proc.stderr.on('data', (data) => console.error(chalk.greenBright(scriptName), data.toString()));
        proc.stdout.on('close', () => resolve());
        proc.on('error', (e) => reject(e));
        proc.on('exit', (errorCode) => {
          if (typeof errorCode === 'number' && errorCode !== 0) {
            reject({ errorCode });
          }
        });
    }));
}

export const rootFilenameRegex = /^(\d+x\d+)(.*)\.png$/;

/**
 * @param {RegExpMatchArray} matched 
 * @returns {FileMeta}
 */
export function metaFromRootFilename(matched) {
  const srcName = matched[0];
  const gridDim = /** @type {[number, number]} */ (matched[1].split('x').map(x => Number(x) / 5));
  const id = -1;
  const ids = [id];
  const description = normalizeChars(matched[2]);
  const dstName = `${gridDim[0]}x${gridDim[1]}${description ? `--${description}` : ''}.png`;
  return { srcName, dstName, id, gridDim, is: ['root'], has: [], ids };
}

export const geomorphsFilenameRegex = /^([A-Z]+)?([\d,]+) \[(\d+x\d+)\] ([^(]*)(.*)\.png$/;

/**
 * @param {RegExpMatchArray} matched 
 * @returns {FileMeta}
 */
export function metaFromGeomorphFilename(matched) {
  const srcName = matched[0];
  const ids = matched[1] ? [-1] : matched[2].split(',').map(Number);
  const id = ids[0];
  const extendedId = matched[1] ? `${matched[1]}${matched[2]}` : undefined;
  const gridDim = /** @type {[number, number]} */ (matched[3].split('x').map(x => Number(x) / 5));
  const description = matched[4].concat(matched[5]);
  const { label, is, has } = extractGeomorphInfo(description);
  const dstName =`g-${extendedId || matched[2].split(',')[0]}--${label}.png`;
  return { srcName, dstName, id, gridDim, is, has, ids, extendedId };
}

/**
 * [1: category] [2: local_id][3: a-z]? [4: subcategory ]?[5: width*height][6: meta].png
 */
export const symbolsFilenameRegex = /^(.*) (\d+)([a-z])? (?:(.+) )?\[(\d+x\d+)\](.*)\.png$/;

/**
 * @param {RegExpMatchArray} matched 
 * @returns {FileMeta}
 */
export function metaFromSymbolFilename(matched) {
  let category = normalizeChars(matched[1]);
  if (matched[4]) category += `-${normalizeChars(matched[4])}`;
  const id = Number(matched[2]);
  const ids = [id];
  const gridDim = /** @type {[number, number]} */ (matched[5].split('x').map(x => Number(x) / 5));
  // ids are local unlike geomorphs
  const is = /** @type {string[]} */ ([]);
  const has = /** @type {string[]} */ ([]);
  if (matched[3]) is.push(`part-${matched[3]}`);
  if (matched[6]) {
    is.push(normalizeChars(matched[6]));
    has.push(...matched[6].split(',').map(normalizeChars));
  }
  return {
    srcName: matched[0],
    dstName: `${category}--${matched[2]}--${gridDim[0]}x${gridDim[1]}.png`,
    id, gridDim, is, has, ids,
  };
}

/**
 * [1: category] [2: width*height].png
 */
export const altSymbolsFilenameRegex = /^(.*) \[(\d+x\d+)\]\.png$/;

/**
 * @param {RegExpMatchArray} matched 
 * @returns {FileMeta}
 */
export function metaFromAltSymbolFilename(matched) {
  const category = normalizeChars(matched[1]);
  const gridDim = /** @type {[number, number]} */ (matched[2].split('x').map(x => Number(x) / 5));
  return { 
    srcName: matched[0],
    dstName: `${category}--${gridDim[0]}x${gridDim[1]}.png`,
    id: -1, gridDim, is: [], has: [], ids: [-1],
  };
}

export const smallCraftFilenameRegex = /^(.*).png$/;

/**
 * @param {RegExpMatchArray} matched 
 * @returns {FileMeta}
 */
export function metaFromSmallCraftFilename(matched) {
  return {
    srcName: matched[0],
    dstName: `${normalizeChars(matched[1])}--small-craft.png`,
    id: -1,
    /** Unfortunately, grid dimension not provided in original filename. */
    gridDim: [0, 0],
    is: [], has: [], ids: [-1],
  };
}

/**
 * @param {string} info 
 * @returns {FilenameMeta}
 */
function extractGeomorphInfo(info) {
  const is = /** @type {string[]} */ ([]);
  const has = /** @type {string[]} */  ([])
  const parts = info.split(' ');

  if (parts[0] === '[Overlay]') {
    is.push(assertDefined(parts.shift()).slice(1, -1).toLowerCase());
  }
  if (parts[0].match(/^\(\d+\)$/)) {
    is.push(`part-${assertDefined(parts.shift()).slice(1, -1)}`);
  }
  if (parts[0].match(/^\d+x$/)) {
    is.push(assertDefined(parts.shift()).toLowerCase());
  }

  const startBracket = parts.findIndex(x => x.startsWith('('));
  if (startBracket !== -1) {
    const bracketed = parts.splice(startBracket, parts.length).join(' ').slice(1, -1);
    has.push(...bracketed.split(',').map(x => normalizeChars(x)).filter(Boolean));
  }
  
  return {
    label: normalizeChars(parts.join('-')),
    is,
    has,
  };
}

/**
 * @param {string} word 
 */
function normalizeChars(word) {
  return word.trim().toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[ -]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  ;
}

/**
 * @param {string} folderName e.g. `top_down_man_base`
 * @param {string} baseName e.g. `man_01_base`
 */
export async function loadSpineServerSide(folderName, baseName) {
  const spineExportFolder = `${npcAssetsFolder}/${folderName}`;
  const topDownManAtlasContents = fs
    .readFileSync(`${spineExportFolder}/${baseName}.atlas`)
    .toString();
  const skeletonDataJson = fs
    .readFileSync(`${spineExportFolder}/${baseName}.json`)
    .toString();

  const textureAtlas = new TextureAtlas();
  await new Promise((resolve, reject) =>
    textureAtlas.addSpineAtlas(
      topDownManAtlasContents,
      async (line, callback) =>
        Assets.load(`${spineExportFolder}/${line}`).then((tex) =>
          callback(tex)
        ),
      (atlas) =>
        atlas
          ? resolve(atlas)
          : reject(`something went wrong e.g. texture failed to load`)
    )
  );

  const atlasLoader = new AtlasAttachmentLoader(textureAtlas);
  const skeletonParser = new SkeletonJson(atlasLoader);
  skeletonParser.scale = skeletonScale;

  const skeletonData = skeletonParser.readSkeletonData(skeletonDataJson);
  return { atlasLoader, data: skeletonData };
}

/**
 * `bounds` is actually the smallest integer-ordinate rectangle containing `poly.rect`.
 * @param {Spine} spine 
 * @param {string} slotName
 * @returns {{ poly: Geom.Poly; bounds: Geom.Rect }}
 */
export function computeSpineAttachmentBounds(spine, slotName) {
  const slot = spine.skeleton.findSlot(slotName);
  const attachment = slot.getAttachment();
  // console.log('attachment', slot, attachment);

  if (attachment instanceof BoundingBoxAttachment) {
    const vertices = /** @type {number[]} */ ([]);
    attachment.computeWorldVerticesOld(slot, vertices);
    const poly = new Poly(Vect.fromCoords(vertices))
    return { poly, bounds: poly.rect.integerOrds() };
  }

  if (attachment instanceof RegionAttachment) {
    const vertices = /** @type {number[]} */ ([]);
    attachment.updateRegion();
    attachment.computeWorldVertices(slot, vertices, 0, 2);
    const poly = new Poly(Vect.fromCoords(vertices))
    return { poly, bounds: poly.rect.integerOrds() };
  }

  throw Error(`${slotName}: unhandled attachment: ${attachment?.name || attachment}`);
}

/**
 * @typedef FileMeta @type {object}
 * @property {string} srcName
 * @property {number} id Numeric identifier from Starship Geomorphs 2.0
 * @property {number[]} ids Sometimes a range is given
 * @property {string} [extendedId]
 * @property {[number, number]} gridDim Dimension in grid squares of Starship Geomorphs 2.0
 * @property {string} dstName
 * @property {string[]} is
 * @property {string[]} has
 */

/**
 * @typedef FilenameMeta @type {object}
 * @property {string} label
 * @property {string[]} is
 * @property {string[]} has
 */

/**
 * @typedef SpineMeta
 * @property {string} folderName
 * @property {string} baseName
 * @property {number} skeletonScale
 * @property {13} npcRadius In Starship Geomorph coordinates
 * @property {number} npcScaleFactor
 * Enforces a radius of `13` in our notion of world coords (based on Starship Geomorphs).
 * > `(2 * 13) / anim.idle.animBounds.width`
 * @property {Record<string, SpineAnimMeta>} anim
 * Animation name to metadata.
 * @property {Record<NPC.SpineHeadSkinName, SpineHeadMeta>} head
 * Head skin name to metadata.
 * @property {Record<'circular-bounds', { packedRect: Geom.RectJson }>} extra
 * Head skin name to metadata.
 * @property {number} packedWidth
 * @property {number} packedHeight
 * @property {number} packedPadding
 */

/**
 * @typedef SpineAnimMeta
 * @property {string} animName
 * @property {number} frameCount
 * @property {number} frameDurSecs
 * @property {Geom.RectJson} animBounds
 * Over all frames of animation (manually specified in Spine).
 * @property {Geom.RectJson} headBounds The bounds from first frame.
 * @property {Geom.VectJson[]} neckPositions
 * @property {Geom.RectJson[]} packedRects
 * - each has width/height of `animBounds`
 * @property {{ x: number; y: number; angle: number; width: number; height: number; }[]} headFrames
 * - aligned to frames
 * - (x, y) is world position of 2nd vertex of head attachment 4-gon,
 *   which in pixi.js corresponds to top-left (unrotated)
 * - `angle` (degrees) of head attachment 4-gon in world coords
 * - `width` of head attachment 4-gon (unrotated)
 * @property {number[]} rootDeltas
 * - root motion in 'y direction' per frame
 * - empty iff no motion
 */

/**
 * @typedef SpineHeadMeta
 * @property {NPC.SpineHeadSkinName} headSkinName
 * @property {{ [x in 'top' | 'face']: Geom.RectJson}} packedHead
 * - Top of head e.g. when walking
 * - Face of head e.g. when lying down
 */
