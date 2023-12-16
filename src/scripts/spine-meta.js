/**
 * Compute json with:
 * - per-anim packing for runtime spritesheets
 * - per-anim frame count, head frames, ...
 */
/// <reference path="./deps.d.ts"/>

import { Assets } from "@pixi/node";
import { Spine, Skin } from "@pixi-spine/runtime-4.1";
import { MaxRectsPacker, Rectangle } from "maxrects-packer";

import { precision } from "../projects/service/generic";
import { skeletonScale } from "../projects/world/const";
import { spineAnimToFrames, spineHeadOrients, spineHeadSkinNames } from "../projects/world-pixi/const";
import { writeAsJson } from "../projects/service/file";
import { Rect, Vect } from "../projects/geom";
import {
  computeSpineAttachmentBounds,
  loadSpineServerSide,
  npcAssetsFolder,
  runYarnScript,
} from "./service";

const folderName = "top_down_man_base";
const baseName = "man_01_base";
/** Exclude this file from being watched to avoid infinite loop */
const outputJsonFilepath = `${npcAssetsFolder}/${folderName}/spine-meta.json`;
const packedPadding = 2;

main();

export default async function main() {
  await Assets.init({
    skipDetections: true,
  });

  // Load skeleton
  const { data } = await loadSpineServerSide(folderName, baseName);
  const spine = new Spine(data);

  // Set skin for body animations
  const newSkin = new Skin("npc-default-skin");
  newSkin.addSkin(spine.spineData.findSkin("shoes/black-trainers"));
  newSkin.addSkin(spine.spineData.findSkin("trousers/black-trousers"));
  newSkin.addSkin(spine.spineData.findSkin("torso/black-shirt"));
  newSkin.addSkin(spine.spineData.findSkin("gloves/grey-gloves"));
  newSkin.addSkin(spine.spineData.findSkin("head/skin-head-light"));
  spine.skeleton.setSkin(newSkin);
  spine.skeleton.setSlotsToSetupPose();

  // Compute global body scale
  const { bounds: idleAnimBounds } = computeSpineAttachmentBounds(spine, "anim-bounds");
  const npcScaleFactor = precision((2 * 13) / idleAnimBounds.width, 4);

  // For rect packing
  const packer = new MaxRectsPacker(4096, 4096, packedPadding, {
    pot: false,
    border: packedPadding,
    // smart: false,
  });
  const rectsToPack = /** @type {import("maxrects-packer").Rectangle[]} */ ([]);
  /** @param {number} width @param {number} height @param {string} name */
  function addRectToPack(width, height, name) {
    console.log("➕", width, height, name);
    const r = new Rectangle(width, height);
    r.data = { name };
    rectsToPack.push(r);
  }

  const outputAnimMeta =
    /** @type {import("./service").SpineMeta['anim']} */ ({});

  const { animations } = spine.spineData;
  spine.autoUpdate = false;
  spine.skeleton.setBonesToSetupPose();
  for (const anim of animations) {
    const animName = /** @type {NPC.SpineAnimName} */ (anim.name);

    /**
     * Listen for events e.g. footsteps.
     * @type {import('@pixi-spine/runtime-4.1').AnimationStateListener}
     */
    const spineListener = { event(_entry, event) {
      console.log('event', event);
    }};
    spine.state.addListener(spineListener);

    spine.state.setAnimation(0, anim.name, false);
    spine.update(0);

    /**
     * Extract bounding box per animation, stored as attachment "anim-bounds".
     * We did not use spine.skeleton.getBoundsRect() because it was too big:
     * attachments are bounded by their transformed rect, not occurring pixels.
     */
    const { bounds: animBounds } = computeSpineAttachmentBounds(spine, "anim-bounds");
    const { bounds: headBounds } = computeSpineAttachmentBounds(spine, "head");
    
    /**
     * Compute head attachment top-left position, angle, scale per frame.
     * 🚧 Compute root offset per frame when `footstep` event available (i.e. walk).
    */
    const frameCount = spineAnimToFrames[animName];
    const frameDurSecs = anim.duration / frameCount;
    const headFrames = /** @type {import("./service").SpineAnimMeta['headFrames']} */ ([]);
    for (let i = 0; i < frameCount; i++) {
      spine.update(i === 0 ? 0 : frameDurSecs);

      const poly = computeSpineAttachmentBounds(spine, 'head').poly.precision(2);
      // [nw, sw, se, ne] becomes [sw, nw, ne, se] in pixi.js (y flips)
      const [, nw, ne] = poly.outline;
      headFrames.push({
        x: precision(nw.x * npcScaleFactor, 4),
        y: precision(nw.y * npcScaleFactor, 4),
        angle: precision(Math.atan2(ne.y - nw.y, ne.x - nw.x) * (180 / Math.PI), 4),
        // Used to scale (head-skin-specific) head
        width: precision(npcScaleFactor * Vect.distanceBetween(ne, nw), 4),
      });
      // console.log('events', spine.state.events);
    }

    spine.state.removeListener(spineListener);

    outputAnimMeta[anim.name] = {
      animName,
      frameCount,
      frameDurSecs: anim.duration / frameCount,
      animBounds,
      headBounds,
      packedRect: { x: 0, y: 0, width: 0, height: 0 },
      headFrames,
    };

    addRectToPack(
      // Ensure horizontal padding between frames
      animBounds.width * frameCount + packedPadding * (frameCount - 1),
      animBounds.height,
      anim.name
    );
  }

  const headSlot = spine.skeleton.findSlot('head');
  const hairSlot = spine.skeleton.findSlot('hair');
  for (const headSkinName of spineHeadSkinNames) {
    const headSkin = spine.spineData.findSkin(headSkinName);
    
    for (const { headOrientKey, animName, headAttachmentName, hairAttachmentName } of spineHeadOrients) {
      spine.skeleton.setSkin(headSkin);
      spine.skeleton.setSlotsToSetupPose();
      spine.skeleton.setBonesToSetupPose();
      spine.state.setAnimation(0, animName, false);
      headSlot.setAttachment(spine.skeleton.getAttachmentByName('head', headAttachmentName));
      hairSlot.setAttachment(spine.skeleton.getAttachmentByName('hair', hairAttachmentName));
      spine.update(0);

      const bounds = Rect.fromRects(
        computeSpineAttachmentBounds(spine, 'head').bounds,
        // head skin may not have hair
        hairSlot.attachment ? computeSpineAttachmentBounds(spine, 'hair').bounds : Rect.zero,
      ).precision(4);
      addRectToPack(bounds.width, bounds.height, `${headSkinName}:${headOrientKey}`);
    }
  }

  /**
   * Compute rectangle packing.
   */
  packer.addArray(rectsToPack);
  // packer.repack();
  const { bins } = packer;
  const bin = bins[0];

  if (bins.length !== 1) {
    throw Error(`spine-meta: expected exactly one bin (${bins.length})`);
  } else if (bins[0].rects.length !== rectsToPack.length) {
    throw Error(
      `spine-meta: expected every animation to be packed (${bins.length} of ${rectsToPack.length})`
    );
  }

  const packedWidth = bin.width;
  const packedHeight = bin.height;

  for (const anim of animations) {
    const r = bin.rects.find((x) => x.data.name === anim.name);
    if (!r) throw Error(`spine-meta: ${anim.name}: packed rect not found`);
    outputAnimMeta[anim.name].packedRect = { x: r.x, y: r.y, width: r.width, height: r.height };
  }

  const outputHeadMeta = spineHeadSkinNames.reduce((agg, headSkinName) => {
    agg[headSkinName] = {
      headSkinName,
      packedHead: {
        face: { x: 0, y: 0, width: 0, height: 0 },
        top: { x: 0, y: 0, width: 0, height: 0 },
      }
    };
    return agg;
  }, /** @type {import("./service").SpineMeta['head']} */ ({}));

  for (const headSkinName of spineHeadSkinNames) {
    for (const orient of /** @type {const} */ (['top', 'face'])) {
      const rectName = `${headSkinName}:${orient}`;
      const r = bin.rects.find((x) => x.data.name === rectName);
      if (!r) throw Error(`spine-meta: ${rectName}: packed rect not found`);
      outputHeadMeta[headSkinName].packedHead[orient] = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
  }

  /** @type {import("./service").SpineMeta} */
  const outputJson = {
    folderName,
    baseName,
    skeletonScale,
    npcScaleFactor,
    anim: outputAnimMeta,
    head: outputHeadMeta,
    packedWidth,
    packedHeight,
    packedPadding,
  };
  writeAsJson(outputJson, outputJsonFilepath);

  /**
   * Finally, re-render spritesheet
   */
  await runYarnScript("spine-render");
}
