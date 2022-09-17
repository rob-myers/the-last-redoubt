/**
 * - Usage
 *   - `yarn render-gm-shade 301`
 *     where /geomorph/{gmKey}.json expected to exist 
 */
/// <reference path="./deps.d.ts"/>

import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

import { Poly } from '../projects/geom';
import { saveCanvasAsFile } from '../projects/service/file';
import { parseLayout } from '../projects/service/geomorph';
import { geom } from '../projects/service/geom';
import { fillPolygon } from '../projects/service/dom';
import layoutDefs from '../projects/geomorph/geomorph-layouts';

const geomorphId = Number(process.argv[2]);
const layoutDef = Object.values(layoutDefs).find(x => x.id === geomorphId);
if (!layoutDef) {
  console.error(`No geomorph found with id "${geomorphId}"`);
  process.exit(1);
}

const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const outputDir = path.resolve(staticAssetsDir, 'geomorph');
const outputPath =  path.resolve(outputDir, `${layoutDef.key}.shade.png`);

const geomorphJsonPath = path.resolve(outputDir, `${layoutDef.key}.json`);
if (!fs.existsSync(geomorphJsonPath)) {
  console.error(`JSON not found: ${layoutDef.key}.json`);
  process.exit(1);
}

const scale = 2;

(async function main() {

  /** @type {Geomorph.LayoutJson} */
  const layoutJson = JSON.parse(fs.readFileSync(geomorphJsonPath).toString());
  const layout = parseLayout(layoutJson);

  const canvas = createCanvas(0, 0);
  const pngRect = layout.items[0].pngRect;
  canvas.width = pngRect.width * scale;
  canvas.height = pngRect.height * scale;
  const ctxt = canvas.getContext('2d');
  
  // DEBUG ONLY ⛔️ draw geomorph PNG
  // const geomorphPngPath = path.resolve(outputDir, `${layoutDef.key}.png`);
  // const loadedPng = await loadImage(geomorphPngPath);
  // ctxt.drawImage(loadedPng, 0, 0);

  // Draw the lights
  ctxt.scale(scale, scale);
  ctxt.translate(-pngRect.x, -pngRect.y);
  const lightSources = layout.lightSrcs;
  const allRoomsAndDoors = Poly.union([...layout.rooms, ...layout.doors.map(x => x.poly)])[0];
  const hullPolySansHoles = layout.hullPoly.map(x => x.clone().removeHoles());
  const lights = lightSources.flatMap(({position, direction }) => geom.lightPolygon({
    position,
    range: 2000,
    exterior: allRoomsAndDoors,
    direction,
  }));

  ctxt.fillStyle = 'rgba(0, 0, 0, 0.2)';
  fillPolygon(ctxt, hullPolySansHoles);

  ctxt.globalCompositeOperation = 'lighter';
  // 1/2 of above alpha permits 2 lights to intersect (?)
  ctxt.fillStyle = 'rgba(255, 255, 255, 0.1)';
  lights.forEach(light => fillPolygon(ctxt, [light]));
  await saveCanvasAsFile(canvas, outputPath);

})();
