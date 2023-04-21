/**
 * Usage
 * > `yarn bake-lighting 301`
 */
/// <reference path="./deps.d.ts"/>

import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';

import { runYarnScript } from './service';
import { defaultLightDistance, preDarkenCssRgba } from '../projects/service/const';
import { saveCanvasAsFile } from '../projects/service/file';
import { computeLightPolygons } from '../projects/service/geomorph';
import { fillPolygons } from '../projects/service/dom';
import layoutDefs from '../projects/geomorph/geomorph-layouts';
import { renderLayout } from './render-layout';

const geomorphId = Number(process.argv[2]);
const layoutDef = Object.values(layoutDefs).find(x => x.id === geomorphId);
if (!layoutDef) {
  console.error(`No geomorph found with id "${geomorphId}"`);
  process.exit(1);
}
const foundLayoutDef = layoutDef; // else ts error in main

const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const outputDir = path.resolve(staticAssetsDir, 'geomorph');
const outputPngFilename =  `${layoutDef.key}.lit.png`;

const geomorphJsonPath = path.resolve(outputDir, `${layoutDef.key}.json`);
if (!fs.existsSync(geomorphJsonPath)) {
  console.error(`JSON not found: ${layoutDef.key}.json`);
  process.exit(1);
}

main();

async function main() {

  // Doors are open
  const { canvas, layout } = await renderLayout(foundLayoutDef, { thinDoors: false, debug: false });
  // No need to scale/translate by pngRect (already done)
  const ctxt = canvas.getContext('2d');
  
  // Darken the geomorph
  // ℹ️ thus need to darken unlit drawRects
  const hullPolySansHoles = layout.hullPoly.map(x => x.clone().removeHoles());
  ctxt.fillStyle = preDarkenCssRgba;
  fillPolygons(ctxt, hullPolySansHoles);

  //#region draw lights
  const lightSources = layout.lightSrcs;
  const lightPolys = computeLightPolygons(layout);

  ctxt.globalCompositeOperation = 'lighter';
  // Radial fill with drop off
  lightPolys.forEach((lightPoly, i) => {
    const { position, distance = defaultLightDistance } = lightSources[i];
    const gradient = ctxt.createRadialGradient(position.x, position.y, 1, position.x, position.y, distance);
    gradient.addColorStop(0, '#ffffaa77');
    gradient.addColorStop(1, "#00000000");
    ctxt.fillStyle = gradient;
    fillPolygons(ctxt, [lightPoly]);
  });
  //#endregion

  // Save/optimize png, save webp
  // Temp dir avoids breaking gatsby (watching static/assets)
  const tempDir = fs.mkdtempSync('pngquant-');
  await saveCanvasAsFile(canvas, `${tempDir}/${outputPngFilename}`);
  await runYarnScript('minify-pngs', tempDir, '--webp' ,'--quality=90');
  childProcess.execSync(`cp ${tempDir}/* ${outputDir}`);
  fs.rmSync(tempDir, { force: true, recursive: true });
}
