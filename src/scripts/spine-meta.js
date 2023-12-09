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
import { writeAsJson } from "../projects/service/file";
import { Rect } from "../projects/geom";

const repoRoot = path.resolve(__dirname, "../..");
const npcFolder = path.resolve(repoRoot, `static/assets/npc`);
const outputDir = path.resolve(repoRoot, "src/projects/world-pixi");
const outputJsonFilepath = path.resolve(outputDir, "spine-meta.json");

// 🚧 hard-coded
const folderName = "top_down_man_base";
const baseName = "man_01_base";
const animToFrames = { idle: 1, sit: 1, lie: 1, "idle-breathe": 20, walk: 20 };

main();

export default async function main() {

  /** @type {SpineMeta} */
  const outputJson = {
    folderName,
    baseName,
    anim: {},
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

  // Compute bounding box per animation
  spine.state.setAnimation(0, "idle", false);
  spine.autoUpdate = false;
  spine.update(0);

  for (const anim of spine.spineData.animations) {
    const frCnt = animToFrames[/** @type {keyof animToFrames} */ (anim.name)];
    const frDur = anim.duration / frCnt;
    spine.state.setAnimation(0, anim.name, false);
    const frameRects = /** @type {Geom.RectJson[]} */ ([]);

    for (let frame = 0; frame < frCnt; frame++) {
      spine.update(frame === 0 ? 0 : frDur);
      const frameRect = spine.skeleton.getBoundsRect();
      frameRects.push(frameRect);
      // console.log(anim.name, frame, frameRect.width, frameRect.height);
    }

    const animRect = Rect.fromRects(...frameRects).integerOrds();
    // console.log(anim.name, animRect.width, animRect.height);
    outputJson.anim[anim.name] = {
      frameCount: frCnt,
      bounds: animRect,
    };
  }

  writeAsJson(outputJson, outputJsonFilepath);
}

/**
 * @param {string} folderName e.g. `top_down_man_base`
 * @param {string} baseName e.g. `man_01_base`
 */
async function loadSpineServerSide(folderName, baseName) {
  const spineExportFolder = `${npcFolder}/${folderName}`;
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
  skeletonParser.scale = 0.1;

  const skeletonData = skeletonParser.readSkeletonData(skeletonDataJson);
  return { atlasLoader, data: skeletonData };
}

/**
 * @typedef SpineMeta
 * @property {string} folderName
 * @property {string} baseName
 * @property {Record<string, {
 *   frameCount: number;
 *   bounds: Geom.RectJson;
 * }>} anim Animation name to metadata.
 */
