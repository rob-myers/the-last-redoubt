/**
 * Usage
 * > `yarn bake-lighting 301`
 */
/// <reference path="./deps.d.ts"/>

import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';

import { Poly } from '../projects/geom';
import { saveCanvasAsFile } from '../projects/service/file';
import { getNormalizedDoorPolys } from '../projects/service/geomorph';
import { geom } from '../projects/service/geom';
import { fillPolygon } from '../projects/service/dom';
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
const outputPngPath =  path.resolve(outputDir, `${layoutDef.key}.lit.png`);

const geomorphJsonPath = path.resolve(outputDir, `${layoutDef.key}.json`);
if (!fs.existsSync(geomorphJsonPath)) {
  console.error(`JSON not found: ${layoutDef.key}.json`);
  process.exit(1);
}

main();

async function main() {

  // Doors are open
  const { canvas, layout } = await renderLayout(foundLayoutDef, { open: true, debug: false });
  // No need to scale/translate by pngRect (already done)
  const ctxt = canvas.getContext('2d');
  
  // Darken the geomorph
  // 🚧 thus need to darken unlit drawRects
  const hullPolySansHoles = layout.hullPoly.map(x => x.clone().removeHoles());
  ctxt.fillStyle = 'rgba(0, 0, 0, 0.5)';
  fillPolygon(ctxt, hullPolySansHoles);

  //#region draw lights
  const lightSources = layout.lightSrcs;
  /** More than one polygon can happen e.g. Geomorph 102 */
  const allRoomsAndDoors = Poly.union([
    ...layout.rooms,
    ...getNormalizedDoorPolys(layout.doors), // must extrude hull doors
    ...layout.windows.map(x => x.poly),
  ]);
  const lights = lightSources.map(({ position, direction }, i) => {
    const exterior = allRoomsAndDoors.find(poly => poly.contains(position));
    if (exterior) {
      return geom.lightPolygon({ position, range: 2000, exterior, direction });
    } else {
      console.error(`ignored light ${i} (${JSON.stringify(position)}): no exterior found`);
      return new Poly;
    }
  });

  ctxt.globalCompositeOperation = 'lighter';
  // Radial fill with drop off
  lights.forEach((light, i) => {
    const { position, direction } = lightSources[i];
    const gradient = ctxt.createRadialGradient(position.x, position.y, 1, position.x, position.y, 300)
    gradient.addColorStop(0, '#ffffaa55');
    gradient.addColorStop(0.9, "#00000000");
    gradient.addColorStop(1, "#00000000");
    ctxt.fillStyle = gradient;
    fillPolygon(ctxt, [light]);
  });
  //#endregion

  // Save PNG
  await saveCanvasAsFile(canvas, outputPngPath);
  // Generate WEBP
  childProcess.execSync(`cwebp ${outputPngPath} -o ${outputPngPath.replace(/^(.*)\.png$/, '$1.webp')}`);
  // Minify PNG
  // ⛔️ seen worse than tinypng (467kb vs 534kb)
  childProcess.execSync(`pngquant -f ${outputPngPath} && mv ${outputPngPath.replace(/\.png$/, '-fs8.png')} ${outputPngPath}`);

}
