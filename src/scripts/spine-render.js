/**
 * Render spritesheet using:
 * - spine export
 * - spine-meta.json created by script spine-meta
 */
/// <reference path="./deps.d.ts"/>

import fs from "fs";

import { Assets, RenderTexture, Application, Sprite, Rectangle } from "@pixi/node";
import { Spine, Skin } from "@pixi-spine/runtime-4.1";
import { Canvas, ImageData } from "canvas";

import { saveCanvasAsFile } from "../projects/service/file";
import { loadSpineServerSide, npcAssetsFolder, runYarnScript } from "./service";

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
    packedWidth,
    packedHeight,
    packedPadding,
  } = JSON.parse(fs.readFileSync(spineMetaJsonPath).toString());
  
  const app = new Application();
  const tex = RenderTexture.create({ width: packedWidth, height: packedHeight });

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

  const { animations } = spine.spineData;
  spine.autoUpdate = false;
  spine.skeleton.setBonesToSetupPose();

  for (const anim of animations) {
    const { frameCount, frameDuration, animBounds, packedRect } = animMeta[anim.name];
    spine.state.setAnimation(0, anim.name, false);
    
    // 🚧
    for (let frame = 0; frame < frameCount; frame++) {
      spine.update(frame === 0 ? 0 : frameDuration);
      // `animBounds` where root attachment is at `(0, 0)`.
      /**
       * `animBounds` for frame `frame` is at:
       * - packedRect.x + frame * (animBounds.width + meta.packedPadding)
       * - packedRect.y
       * - animBounds.width
       * - animBounds.height
       */
      spine.position.set(
        packedRect.x + (frame * (animBounds.width + packedPadding)) + Math.abs(animBounds.x),
        packedRect.y + Math.abs(animBounds.y),
      );
      app.renderer.render(spine, {
        renderTexture: tex,
        clear: false,
      });
    }
  }

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
