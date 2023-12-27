/**
 * Render spritesheet using:
 * - spine export
 * - spine-meta.json created by script `yarn spine-meta`
 * 
 * Usage:
 * - yarn spine-render
 * - yarn spine-render --debug
 */
/// <reference path="./deps.d.ts"/>

import fs from "fs";
import getOpts from 'getopts';
const opts = getOpts(process.argv);

import { Assets, RenderTexture, Application, Sprite, Graphics } from "@pixi/node";
import { Spine, Skin } from "@pixi-spine/runtime-4.1";
import { Canvas, ImageData } from "canvas";

import { saveCanvasAsFile } from "../projects/service/file";
import { Rect } from "../projects/geom";
import { spineHeadOrients, spineHeadSkinNames } from "../projects/world-pixi/const";
import { computeSpineAttachmentBounds, loadSpineServerSide, npcAssetsFolder, runYarnScript } from "./service";

const folderName = "top_down_man_base";
const baseName = "man_01_base";
const spineMetaJsonPath = `${npcAssetsFolder}/${folderName}/spine-meta.json`;
const outputFolder = `${npcAssetsFolder}/${folderName}/spine-render`;
const outputFilepath = `${outputFolder}/spritesheet.png`;

main();

export default async function main() {

  /** @type {import("./service").SpineMeta} */
  const {
    anim: animMeta,
    head: headMeta,
    packedWidth,
    packedHeight,
    extra: extraMeta,
  } = JSON.parse(fs.readFileSync(spineMetaJsonPath).toString());
  
  const app = new Application();
  const tex = RenderTexture.create({ width: packedWidth, height: packedHeight });

  await Assets.init({
    skipDetections: true,
  });

  if (opts.debug) {// Debug Rectangle Packing
    const gfx = (new Graphics).lineStyle({ width: 1, color: 0x00ff00 });
    gfx.beginFill(0, 0).drawRect(0, 0, packedWidth, packedHeight).endFill();
    Object.values(animMeta).forEach(({ packedRects }) =>
      packedRects.forEach(packedRect =>
        gfx.beginFill(0, 0).drawRect(packedRect.x, packedRect.y, packedRect.width, packedRect.height).endFill()
      )
    );
    Object.values(headMeta).forEach(({ packedHead: { face, top } }) => {
      gfx.beginFill(0, 0).drawRect(face.x, face.y, face.width, face.height).endFill();
      gfx.beginFill(0, 0).drawRect(top.x, top.y, top.width, top.height).endFill();
    });
    app.renderer.render(gfx, { renderTexture: tex });
  }

  // Load skeleton
  const { data } = await loadSpineServerSide(folderName, baseName);
  const spine = new Spine(data);

  const newSkin = new Skin("npc-default-skin");
  newSkin.addSkin(spine.spineData.findSkin("shoes/black-trainers"));
  newSkin.addSkin(spine.spineData.findSkin("trousers/black-trousers"));
  newSkin.addSkin(spine.spineData.findSkin("torso/black-shirt"));
  newSkin.addSkin(spine.spineData.findSkin("gloves/grey-gloves"));
  if (opts.debug) {
    newSkin.addSkin(spine.spineData.findSkin("head/skin-head-light"));
  }
  spine.skeleton.setSkin(newSkin);
  spine.skeleton.setSlotsToSetupPose();

  const { animations } = spine.spineData;
  spine.autoUpdate = false;
  spine.skeleton.setBonesToSetupPose();

  // Render bodies
  for (const anim of animations) {
    const { frameCount, frameDurSecs, animBounds, packedRects } = animMeta[anim.name];
    spine.state.setAnimation(0, anim.name, false);
    
    for (let frame = 0; frame < frameCount; frame++) {
      const packedRect = packedRects[frame];
      spine.update(frame === 0 ? 0 : frameDurSecs);
      /**
       * - each `packedRect` has some width/height as `animBounds`
       * - `animBounds` has root attachment at `(0, 0)`.
       * - rects from same animation not necessarily contiguous
       */
      spine.position.set(
        packedRect.x + Math.abs(animBounds.x),
        packedRect.y + Math.abs(animBounds.y),
      );
      app.renderer.render(spine, { renderTexture: tex, clear: false });

      if (opts.debug) {
        const { poly } = computeSpineAttachmentBounds(spine, 'head');
        poly.translate(spine.x, spine.y);
        app.renderer.render(
          (new Graphics).lineStyle({ width: 1, color: 0xff0000 }).beginFill(0, 0).drawPolygon(poly.outline), 
          { renderTexture: tex, clear: false },
        );
      }
    }
  }

  // Render heads
  const headSlot = spine.skeleton.findSlot('head');
  const hairSlot = spine.skeleton.findSlot('hair');
  for (const headSkinName of spineHeadSkinNames) {
    const headSkin = spine.spineData.findSkin(headSkinName);

    const { packedHead } = headMeta[headSkinName];
    for (const { headOrientKey, animName, headAttachmentName, hairAttachmentName } of spineHeadOrients) {
      const { animBounds, headBounds } = animMeta[animName];

      spine.skeleton.setSkin(headSkin);
      spine.skeleton.setSlotsToSetupPose();
      spine.skeleton.setBonesToSetupPose();
      spine.state.setAnimation(0, animName, false);

      headSlot.setAttachment(spine.skeleton.getAttachmentByName('head', headAttachmentName));
      hairSlot.setAttachment(spine.skeleton.getAttachmentByName('hair', hairAttachmentName));
      spine.update(0);

      spine.position.set(
        packedHead[headOrientKey].x + Math.abs(animBounds.x) - Math.abs(headBounds.x - animBounds.x),
        packedHead[headOrientKey].y + Math.abs(animBounds.y) - Math.abs(headBounds.y - animBounds.y),
      );
      app.renderer.render(spine, { renderTexture: tex, clear: false });

      if (opts.debug) {
        const { poly } = computeSpineAttachmentBounds(spine, 'head');
        poly.translate(spine.x, spine.y);
        app.renderer.render(
          (new Graphics).lineStyle({ width: 1, color: 0xff0000 }).beginFill(0, 0).drawPolygon(poly.outline), 
          { renderTexture: tex, clear: false },
        );
      }
    }
  }

  // Render extras:
  // - circular bounds
  const circBoundsRect = Rect.fromJson(extraMeta["circular-bounds"].packedRect);
  app.renderer.render(
    (new Graphics).lineStyle({ width: 4, color: '#ffffff' }).drawCircle(circBoundsRect.cx, circBoundsRect.cy, circBoundsRect.width/2 - 4),
    { renderTexture: tex, clear: false },
  );

  app.stage.addChild(new Sprite(tex));
  const pixels = new Uint8ClampedArray(app.renderer.extract.pixels(app.stage));
  const canvas = new Canvas(tex.width, tex.height);
  const ctxt = canvas.getContext('2d');
  const imageData = new ImageData(pixels, tex.width, tex.height);
  ctxt.putImageData(imageData, 0, 0);
  
  app.destroy();

  fs.mkdirSync(outputFolder, { recursive: true });
  await saveCanvasAsFile(canvas, outputFilepath);

  await runYarnScript('pngs-to-webp', outputFolder);
  
}
