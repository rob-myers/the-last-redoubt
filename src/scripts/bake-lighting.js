/**
 * Usage
 * > `yarn bake-lighting 301`
 */
/// <reference path="./deps.d.ts"/>

import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';

import { runYarnScript } from './service';
import { defaultLightDistance } from '../projects/service/const';
import { saveCanvasAsFile } from '../projects/service/file';
import { computeLightPolygons } from '../projects/service/geomorph';
import { fillPolygons } from '../projects/service/dom';
import layoutDefs from '../projects/geomorph/geomorph-layouts';
/**
 * 👋 This import causes `yarn render-layout {args}` 
 */
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

(async function main() {

  // Doors are open
  const { canvas, layout } = await renderLayout(foundLayoutDef, {
    thinDoors: false,
    debug: false,
    invertSymbols: true,
    darken: true,
    arrows: true,
  });
  // No need to scale/translate by pngRect (already done)
  const ctxt = canvas.getContext('2d');
  

  //#region draw lights
  const lightSources = layout.lightSrcs;
  const lightPolys = computeLightPolygons(layout);

  ctxt.globalCompositeOperation = 'lighter';
  // Radial fill with drop off
  lightPolys.forEach((lightPoly, i) => {
    const { position, distance = defaultLightDistance } = lightSources[i];
    const gradient = ctxt.createRadialGradient(position.x, position.y, 1, position.x, position.y, distance);
    gradient.addColorStop(0, '#ffffff77');
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
})();
