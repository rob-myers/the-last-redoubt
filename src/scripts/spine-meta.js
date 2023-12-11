/**
 * Compute json with:
 * - per-anim packing for runtime spritesheets
 * - per-anim frame count
 */
/// <reference path="./deps.d.ts"/>

import path from "path";
import { Assets } from "@pixi/node";
import { Spine, BoundingBoxAttachment } from "@pixi-spine/runtime-4.1";
import { MaxRectsPacker, Rectangle } from 'maxrects-packer';

import { skeletonScale } from "../projects/world/const";
import { writeAsJson } from "../projects/service/file";
import { Rect, Vect } from "../projects/geom";
import { loadSpineServerSide } from "./service";

const repoRoot = path.resolve(__dirname, "../..");
const npcFolder = path.resolve(repoRoot, `static/assets/npc`);
const folderName = "top_down_man_base";
const baseName = "man_01_base";
/** Exclude this file from being watched to avoid infinite loop */
const outputJsonFilepath = `${npcFolder}/${folderName}/spine-meta.json`;

const animToFrames = {
  idle: 1,
  sit: 1,
  lie: 1,
  "idle-breathe": 20,
  walk: 20,
};
const packedPadding = 2;

main();

export default async function main() {

  await Assets.init({
    skipDetections: true,
  });

  // Load skeleton
  const { data } = await loadSpineServerSide(folderName, baseName);
  const spine = new Spine(data);

  // ℹ️ currently we only read attachment "anim-bounds" so skin doesn't matter
  // const newSkin = new Skin("npc-default-skin");
  // newSkin.addSkin(spine.spineData.findSkin("shoes/black-trainers"));
  // newSkin.addSkin(spine.spineData.findSkin("trousers/black-trousers"));
  // newSkin.addSkin(spine.spineData.findSkin("torso/black-shirt"));
  // newSkin.addSkin(spine.spineData.findSkin("gloves/grey-gloves"));
  // newSkin.addSkin(spine.spineData.findSkin("head/skin-head-light"));
  // spine.skeleton.setSkin(newSkin);
  spine.skeleton.setSlotsToSetupPose();

  // For rect packing
  const packer = new MaxRectsPacker(4096, 4096, packedPadding, { pot: false, border: packedPadding });
  const items = /** @type {import("maxrects-packer").Rectangle[]} */ ([]);

  /**
   * Extract bounding box per animation, stored as attachment "anim-bounds".
   * We did not use spine.skeleton.getBoundsRect() because it was too big:
   * attachments are bounded by their transformed rect, rather than occurring pixels.
   */
  const { animations } = spine.spineData;
  spine.autoUpdate = false;
  spine.skeleton.setBonesToSetupPose();
  const outputAnimMeta = /** @type {import("./service").SpineMeta['anim']} */ ({});

  for (const anim of animations) {
    spine.state.setAnimation(0, anim.name, false);
    spine.update(0);

    const slot = spine.skeleton.findSlot('anim-bounds');
    const attachment = /** @type {BoundingBoxAttachment} */ (slot.getAttachment());
    const output = /** @type {number[]} */ ([]);
    attachment.computeWorldVerticesOld(slot, output);
    const rect = new Rect(), max = new Vect();
    for (let i = 0; i < output.length; i +=2) {
      rect.x = Math.min(rect.x, output[i]);
      rect.y = Math.min(rect.y, output[i + 1]);
      max.x = Math.max(max.x, output[i]);
      max.y = Math.max(max.y, output[i + 1]);
    }
    rect.width = max.x - rect.x;
    rect.height = max.y - rect.y;
    const animBounds = rect.integerOrds();

    const frameCount = animToFrames[/** @type {keyof animToFrames} */ (anim.name)];

    outputAnimMeta[anim.name] = {
      animName: anim.name,
      frameCount,
      frameDuration: anim.duration / frameCount,
      animBounds,
      packedRect: { x: 0, y: 0, width: 0, height: 0 },
    };

    const r = new Rectangle(
      // Ensure horizontal padding between frames
      (animBounds.width * frameCount) + (packedPadding * (frameCount - 1)),
      animBounds.height,
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
    if (!r) throw Error(`spine-meta: ${anim.name}: packed rect not found`);
    outputAnimMeta[anim.name].packedRect = { x: r.x, y: r.y, width: r.width, height: r.height };
  }

  /** @type {import("./service").SpineMeta} */
  const outputJson = {
    folderName,
    baseName,
    skeletonScale,
    anim: outputAnimMeta,
    packedWidth: bin.width,
    packedHeight: bin.height,
    packedPadding,
  };
  writeAsJson(outputJson, outputJsonFilepath);
}
