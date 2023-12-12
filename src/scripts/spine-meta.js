/**
 * Compute json with:
 * - per-anim packing for runtime spritesheets
 * - per-anim frame count
 */
/// <reference path="./deps.d.ts"/>

import {
  Assets,
  RenderTexture,
  Texture,
  Rectangle as PixiRectangle,
} from "@pixi/node";
import { Spine, Skin } from "@pixi-spine/runtime-4.1";
import { MaxRectsPacker, Rectangle } from "maxrects-packer";

import { precision } from "../projects/service/generic";
import { skeletonScale } from "../projects/world/const";
import { writeAsJson } from "../projects/service/file";
import { Rect, Vect } from "../projects/geom";
import { computeSpineAttachmentBounds, loadSpineServerSide, npcAssetsFolder, runYarnScript } from "./service";

const folderName = "top_down_man_base";
const baseName = "man_01_base";
/** Exclude this file from being watched to avoid infinite loop */
const outputJsonFilepath = `${npcAssetsFolder}/${folderName}/spine-meta.json`;

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

  const newSkin = new Skin("npc-default-skin");
  newSkin.addSkin(spine.spineData.findSkin("shoes/black-trainers"));
  newSkin.addSkin(spine.spineData.findSkin("trousers/black-trousers"));
  newSkin.addSkin(spine.spineData.findSkin("torso/black-shirt"));
  newSkin.addSkin(spine.spineData.findSkin("gloves/grey-gloves"));
  newSkin.addSkin(spine.spineData.findSkin("head/skin-head-light"));
  spine.skeleton.setSkin(newSkin);
  spine.skeleton.setSlotsToSetupPose();

  // For rect packing
  const packer = new MaxRectsPacker(4096, 4096, packedPadding, {
    pot: false,
    border: packedPadding,
  });
  const items = /** @type {import("maxrects-packer").Rectangle[]} */ ([]);

  const outputAnimMeta =
    /** @type {import("./service").SpineMeta['anim']} */ ({});

  const { animations } = spine.spineData;
  spine.autoUpdate = false;
  spine.skeleton.setBonesToSetupPose();
  for (const anim of animations) {
    spine.state.setAnimation(0, anim.name, false);
    spine.update(0);
      
    /**
     * Extract bounding box per animation, stored as attachment "anim-bounds".
     * We did not use spine.skeleton.getBoundsRect() because it was too big:
     * attachments are bounded by their transformed rect, not occurring pixels.
     */
    const animBounds = computeSpineAttachmentBounds(spine, 'anim-bounds');
    const headBounds = computeSpineAttachmentBounds(spine, 'head');

    const frameCount =
      animToFrames[/** @type {keyof animToFrames} */ (anim.name)];
    const frameDurSecs = anim.duration / frameCount;

    /**
     * Compute head/neck position/scale per frame.
     */
    const bust = /** @type {import("./service").SpineAnimMeta['bust']} */ ([]);
    for (let i = 0; i < frameCount; i++) {
      spine.update(i === 0 ? 0 : frameDurSecs);
      const neck = spine.skeleton.findBone('neck');
      const head = spine.skeleton.findBone('head');
      bust.push({
        neck: (new Vect(neck.x, neck.y)).precision(4),
        head: (new Vect(head.x, head.y)).precision(4),
        scale: precision(head.scaleX),
      });
    }

    outputAnimMeta[anim.name] = {
      animName: anim.name,
      frameCount,
      frameDurSecs: anim.duration / frameCount,
      animBounds,
      headBounds,
      packedRect: { x: 0, y: 0, width: 0, height: 0 },
      bust,
    };

    const r = new Rectangle(
      // Ensure horizontal padding between frames
      animBounds.width * frameCount + packedPadding * (frameCount - 1),
      animBounds.height
    );
    r.data = { name: anim.name };
    items.push(r);
  }

  /**
   * Compute rectangle packing.
   */
  packer.addArray(items);
  packer.repack();
  const { bins } = packer;
  const bin = bins[0];

  if (bins.length !== 1) {
    throw Error(`spine-meta: expected exactly one bin (${bins.length})`);
  } else if (bins[0].rects.length !== animations.length) {
    throw Error(
      `spine-meta: expected every animation to be packed (${bins.length} of ${animations.length})`
    );
  }

  const packedWidth = bin.width;
  const packedHeight = bin.height;

  for (const anim of animations) {
    const r = bin.rects.find((x) => x.data.name === anim.name);
    if (!r) {
      throw Error(`spine-meta: ${anim.name}: packed rect not found`);
    }
    outputAnimMeta[anim.name].packedRect = {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
    };
  }

  /** @type {import("./service").SpineMeta} */
  const outputJson = {
    folderName,
    baseName,
    skeletonScale,
    anim: outputAnimMeta,
    packedWidth,
    packedHeight,
    packedPadding,
  };
  writeAsJson(outputJson, outputJsonFilepath);

  /**
   * Finally, re-render spritesheet
   */
  await runYarnScript('spine-render');
}
