/**
 * Compute json with:
 * - per-anim packing for spritesheets
 *   - rendered in spine-render
 * - per-anim frame count, head frames, ...
 */
/// <reference path="./deps.d.ts"/>

import { Assets } from "@pixi/node";
import { Spine, Skin } from "@pixi-spine/runtime-4.1";
import { MaxRectsPacker, Rectangle } from "maxrects-packer";

import { keys, pause, precision } from "../projects/service/generic";
import { warn } from "../projects/service/log";
import { ansi } from "../projects/service/const";
import { skeletonScale } from "../projects/world/const";
import { spineAnimToSetup, spineHeadOrients, spineHeadSkinNames } from "../projects/world-pixi/const";
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

  //#region initiate packing
  const packer = new MaxRectsPacker(4096, 4096, packedPadding, {
    pot: false,
    border: packedPadding,
    // smart: false,
  });

  const rectsToPack = /** @type {import("maxrects-packer").Rectangle[]} */ ([]);

  /** @param {number} width @param {number} height @param {string} name */
  function addRectToPack(width, height, name) {
    console.log(`${ansi.Blue}will pack${ansi.Reset}:`, name, { width, height });
    const r = new Rectangle(width, height);
    r.data = { name };
    rectsToPack.push(r);
  }
  //#endregion

  const outputAnimMeta =
    /** @type {import("./service").SpineMeta['anim']} */ ({});

  const { animations } = spine.spineData;
  spine.autoUpdate = false;
  spine.skeleton.setBonesToSetupPose();

  //#region body animation: rects, headFrames, motion tracking
  for (const anim of animations) {
    const animName = /** @type {NPC.SpineAnimName} */ (anim.name);

    if (!(animName in spineAnimToSetup)) {
      warn(`animation ${animName} not specified in spineAnimToSetup`);
      continue;
    }
    
    /** Track motion of moving animations e.g. `walk`. */
    const motion = {
      /** Current foot down */
      footDown: /** @type {null | 'left' | 'right'} */ (null),
      /** For final frame diff */
      firstFootDown: /** @type {null | 'left' | 'right'} */ (null),
      /** Previous position of foot */
      prevFootPos: new Vect,
      /** The output: root motion per frame */
      rootDeltas: /** @type {number[]} */ ([]),
      /** ℹ️ Assume motion is purely within y-axis */
      computeDelta() {
        const prev = motion.prevFootPos;
        const curr = motion.getFootPos();
        // console.log(Math.abs(curr.y - prev.y), prev, curr);
        return precision(Math.abs(curr.y - prev.y) * npcScaleFactor, 4);
      },
      getFootPos() {
        const bone = spine.skeleton.findBone(`${motion.footDown}-shoe`);
        return new Vect(bone.worldX, bone.worldY);
      },
      logEvent: false,
    };

    /** @type {import('@pixi-spine/runtime-4.1').AnimationStateListener} */
    const spineListener = { event(_entry, event) {
      motion.logEvent && console.log('event', event);
      const { data: { name: eventName }, stringValue: eventValue } = event;
      switch (eventName) {
        case 'footstep':
          if (eventValue === 'left' || eventValue === 'right') {
            motion.footDown = eventValue;
            motion.firstFootDown ??= eventValue;
            motion.prevFootPos.copy(motion.getFootPos());
            break;
          }
          warn(`${animName}: footstep: unhandled stringValue: ${eventValue}`);
          break;
        default:
          warn(`${animName}: unhandled spine event: ${eventName}`);
      }
    }};

    spine.state.addListener(spineListener);
    spine.state.setAnimation(0, animName, false);
    spine.update(0);

    // run through animation so that `motion` is initially set
    const { numFrames } = spineAnimToSetup[animName];
    const frameDurSecs = anim.duration / numFrames;
    for (let frame = 0; frame < numFrames; frame++) {
      spine.update(frame === 0 ? 0 : frameDurSecs);
      motion.footDown && (motion.prevFootPos = motion.getFootPos());
    }

    spine.state.setAnimation(0, animName, false);
    spine.update(0);
    motion.logEvent = true;

    /**
     * Extract bounding box per animation, stored as attachment "anim-bounds".
     * We did not use spine.skeleton.getBoundsRect() because it was too big:
     * attachments are bounded by their transformed rect, not occurring pixels.
     */
    const { bounds: animBounds } = computeSpineAttachmentBounds(spine, "anim-bounds");
    const { bounds: headBounds } = computeSpineAttachmentBounds(spine, "head");
    
    /**
     * Compute
     * - head attachment top-left position, angle, scale per frame.
     * - rootDeltas per frame when footstep event available
     * - neckPositions per frame
    */
    const headFrames = /** @type {import("./service").SpineAnimMeta['headFrames']} */ ([]);
    const neckPositions = /** @type {import("./service").SpineAnimMeta['neckPositions']} */ ([]);
    for (let frame = 0; frame < numFrames; frame++) {
      spine.update(frame === 0 ? 0 : frameDurSecs);

      if (motion.footDown) {
        motion.rootDeltas.push(motion.computeDelta());
        motion.prevFootPos = motion.getFootPos();
        await pause(); // Try avoid late events
      }

      const poly = computeSpineAttachmentBounds(spine, 'head').poly.precision(2);
      // [nw, sw, se, ne] becomes [sw, nw, ne, se] in pixi.js (y flips)
      const [sw, nw, ne] = poly.outline;
      headFrames.push({
        x: precision(nw.x * npcScaleFactor, 4),
        y: precision(nw.y * npcScaleFactor, 4),
        angle: precision(Math.atan2(ne.y - nw.y, ne.x - nw.x) * (180 / Math.PI), 4),
        // Used to scale (head-skin-specific) head
        width: precision(npcScaleFactor * Vect.distanceBetween(ne, nw), 4),
        height: precision(npcScaleFactor * Vect.distanceBetween(sw, nw), 4),
      });
      
      const neckBone = spine.skeleton.findBone(`neck`);
      neckPositions.push(new Vect(neckBone.worldX, neckBone.worldY).scale(npcScaleFactor).precision(4));
    }

    spine.state.removeListener(spineListener);

    outputAnimMeta[animName] = {
      animName,
      frameCount: numFrames,
      frameDurSecs: anim.duration / numFrames,
      animBounds,
      headBounds,
      neckPositions,
      packedRects: [...Array(numFrames)].map(_ => unOverriddenRect),
      headFrames,
      rootDeltas: motion.rootDeltas,
    };

    // not necessarily contiguous animations
    [...Array(numFrames)].forEach((_, frame) =>
      addRectToPack(animBounds.width, animBounds.height, `${animName}:${frame}`)
    );
  }
  //#endregion

  //#region head rects
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
  //#endregion

  //#region extras
  const radius = 13 / npcScaleFactor;
  addRectToPack(2 * (radius + 2), 2 * (radius + 2), 'circular-bounds');
  //#endregion

  //#region compute packing
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

  for (const { animName, frameCount } of Object.values(outputAnimMeta)) {
    for (let frame = 0; frame < frameCount; frame++) {
      const rectName = `${animName}:${frame}`;
      const r = bin.rects.find((x) => x.data.name === rectName);
      if (!r) throw Error(`spine-meta: ${rectName}: packed rect not found`);
      outputAnimMeta[animName].packedRects[frame] = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
  }

  const outputHeadMeta = spineHeadSkinNames.reduce((agg, headSkinName) => {
    agg[headSkinName] = {
      headSkinName,
      packedHead: {
        face: unOverriddenRect,
        top: unOverriddenRect,
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

  /** @type {import("./service").SpineMeta['extra']} */
  const outputExtraMeta = {
    'circular-bounds': { packedRect: Rect.zero },
  };
  for (const key of keys(outputExtraMeta)) {
    const r = bin.rects.find((x) => x.data.name === key);
    if (!r) throw Error(`spine-meta: ${key}: packed rect not found`);
    outputExtraMeta[key].packedRect = { x: r.x, y: r.y, width: r.width, height: r.height };
  }
  //#endregion


  /** @type {import("./service").SpineMeta} */
  const outputJson = {
    folderName,
    baseName,
    skeletonScale,
    npcScaleFactor,
    npcRadius: 13,
    anim: outputAnimMeta,
    head: outputHeadMeta,
    extra: outputExtraMeta,
    packedWidth,
    packedHeight,
    packedPadding,
  };
  writeAsJson(outputJson, outputJsonFilepath);

  /**
   * Finally, render spritesheet
   */
  await runYarnScript("spine-render");
}

const unOverriddenRect = Rect.zero;
