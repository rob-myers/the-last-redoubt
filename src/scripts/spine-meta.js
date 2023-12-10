/**
 * Compute data from spine export:
 * - bounding box for each animation
 */
/// <reference path="./deps.d.ts"/>

import fs from "fs";
import path from "path";
import { Assets } from "@pixi/node";
import { TextureAtlas } from "@pixi-spine/base";
import {
  AtlasAttachmentLoader,
  SkeletonJson,
  Spine,
  Skin,
  SkeletonData,
} from "@pixi-spine/runtime-4.1";
import { MaxRectsPacker, Rectangle } from 'maxrects-packer';

import { skeletonScale } from "../projects/world/const";
import { writeAsJson } from "../projects/service/file";
import { error, info } from "../projects/service/log";
import { Rect } from "../projects/geom";

const repoRoot = path.resolve(__dirname, "../..");
const npcFolder = path.resolve(repoRoot, `static/assets/npc`);

// 🚧 hard-coded
const animToFrames = { idle: 1, sit: 1, lie: 1, "idle-breathe": 20, walk: 20 };
const folderName = "top_down_man_base";
const baseName = "man_01_base";
const spineExportFolder = `${npcFolder}/${folderName}`;
/** We must exclude this file from being watched to avoid) infinite loop */
const outputJsonFilepath = `${npcFolder}/${folderName}/spine-meta.json`;
const packedPadding = 2;

main();

export default async function main() {

  /** @type {SpineMeta} */
  const outputJson = {
    folderName,
    baseName,
    skeletonScale,
    anim: {},
    packedWidth: 0,
    packedHeight: 0,
    packedPadding,
  };

  await Assets.init({
    skipDetections: true,
  });

  // Load skeleton
  const { data } = await loadSpineServerSide(folderName, baseName);
  const spine = new Spine(data);

  /**
   * Setup skin:
   * - Black body with grey gloves
   * - The head will change
   */
  const newSkin = new Skin("npc-default-skin");
  newSkin.addSkin(spine.spineData.findSkin("trousers/black-trousers"));
  newSkin.addSkin(spine.spineData.findSkin("torso/black-shirt"));
  newSkin.addSkin(spine.spineData.findSkin("gloves/grey-gloves"));
  newSkin.addSkin(spine.spineData.findSkin("head/skin-head-light"));
  spine.skeleton.setSkin(newSkin);
  spine.skeleton.setSlotsToSetupPose();

  // For rect packing
  const packer = new MaxRectsPacker(4096, 4096, packedPadding, { pot: false, border: packedPadding });
  const items = /** @type {import("maxrects-packer").Rectangle[]} */ ([]);

  // Compute bounding box per animation
  const { animations } = spine.spineData;
  // spine.state.setAnimation(0, "idle", false);
  spine.autoUpdate = false;
  // spine.update(0);

  for (const anim of animations) {
    const frCnt = animToFrames[/** @type {keyof animToFrames} */ (anim.name)];
    const frDur = anim.duration / frCnt;
    const frameRects = /** @type {Geom.RectJson[]} */ ([]);

    spine.skeleton.setBonesToSetupPose();
    spine.state.setAnimation(0, anim.name, false);

    for (let frame = 0; frame < frCnt; frame++) {
      spine.update(frame === 0 ? 0 : frDur);
      // spine.state.update(frame === 0 ? 0 : frDur);
      // spine.state.apply(spine.skeleton);
      // spine.skeleton.updateWorldTransform();
      // 🚧 somehow wrong
      const frameRect = spine.skeleton.getBoundsRect();
      frameRects.push({...frameRect});
      // console.log(anim.name, frameRect);
      // console.log(anim.name, frame, frameRect.width, frameRect.height);
    }

    const maxFrameRect = Rect.fromRects(...frameRects).integerOrds();
    // console.log(anim.name, animRect.width, animRect.height);
    outputJson.anim[anim.name] = {
      animName: anim.name,
      frameCount: frCnt,
      frameDuration: anim.duration / frCnt,
      maxFrameRect,
      packedRect: { x: 0, y: 0, width: 0, height: 0 },
    };

    const r = new Rectangle(
      // Ensure horizontal padding between frames
      (maxFrameRect.width * frCnt) + (packedPadding * (frCnt - 1)),
      maxFrameRect.height,
    );
    r.data = { name: anim.name };
    items.push(r);
  }

  packer.addArray(items);
  packer.repack();
  const { bins } = packer;
  const bin = bins[0];
  // console.log(bin);

  if (bins.length !== 1) {
    throw Error(`spine-meta: expected exactly one bin (${bins.length})`);
  } else if (bins[0].rects.length !== animations.length) {
    throw Error(`spine-meta: expected every animation to be packed (${bins.length} of ${animations.length})`);
  }

  for (const anim of animations) {
    const r = bin.rects.find(x => x.data.name === anim.name);
    if (r) {
      outputJson.anim[anim.name].packedRect = {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      };
    } else {
      throw Error(`spine-meta: ${anim.name}: packed rect not found`);
    }
  }

  outputJson.packedWidth = bin.width;
  outputJson.packedHeight = bin.height;

  writeAsJson(outputJson, outputJsonFilepath);
}

/**
 * @param {string} folderName e.g. `top_down_man_base`
 * @param {string} baseName e.g. `man_01_base`
 */
async function loadSpineServerSide(folderName, baseName) {
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
 * @typedef SpineMeta
 * @property {string} folderName
 * @property {string} baseName
 * @property {number} skeletonScale
 * @property {Record<string, {
 *   animName: string;
 *   frameCount: number;
 *   frameDuration: number;
 *   maxFrameRect: Geom.RectJson;
 *   packedRect: Geom.RectJson;
 * }>} anim
 * Animation name to metadata.
 * - `packedRect` has width `frameCount * maxFrameRect.width` plus inter-frame padding `packedPadding`.
 * - `packedRect` has height `maxFrameRect.height`
 * @property {number} packedWidth
 * @property {number} packedHeight
 * @property {number} packedPadding
 */
