/**
 * Usage
 * > `yarn bake-lighting 301`
 * > where respective `/geomorph/{gmKey}.json` exists
 */
/// <reference path="./deps.d.ts"/>

import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

import { Poly } from '../projects/geom';
import { saveCanvasAsFile } from '../projects/service/file';
import { getNormalizedDoorPolys, parseLayout } from '../projects/service/geomorph';
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
const outputPath =  path.resolve(outputDir, `${layoutDef.key}.lit.png`);

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
  
  // Draw underlying geomorph PNG
  const geomorphPngPath = path.resolve(outputDir, `${layoutDef.key}.png`);
  const loadedPng = await loadImage(geomorphPngPath);
  ctxt.drawImage(loadedPng, 0, 0);

  // Draw the lights
  ctxt.scale(scale, scale);
  ctxt.translate(-pngRect.x, -pngRect.y);
  const lightSources = layout.lightSrcs;
  /** More than one polygon can happen e.g. Geomorph 102 */
  const allRoomsAndDoors = Poly.union([
    ...layout.rooms,
    ...getNormalizedDoorPolys(layout.doors), // must extrude hull doors
    ...layout.windows.map(x => x.poly),
  ]);
  const hullPolySansHoles = layout.hullPoly.map(x => x.clone().removeHoles());
  const lights = lightSources.map(({ position, direction }, i) => {
    const exterior = allRoomsAndDoors.find(poly => poly.contains(position));
    if (exterior) {
      return geom.lightPolygon({ position, range: 2000, exterior, direction });
    } else {
      console.error(`ignored light ${i} (${JSON.stringify(position)}): no exterior found`);
      return new Poly;
    }
  });

  // Darken the geomorph
  ctxt.fillStyle = 'rgba(0, 0, 0, 0.5)';
  fillPolygon(ctxt, hullPolySansHoles);

  ctxt.globalCompositeOperation = 'lighter';
  // Draw lights as radial fill with drop off
  lights.forEach((light, i) => {
    const { position, direction } = lightSources[i];
    const gradient = ctxt.createRadialGradient(position.x, position.y, 1, position.x, position.y, 300)
    gradient.addColorStop(0, '#ffffaa55');
    gradient.addColorStop(0.9, "#00000000");
    gradient.addColorStop(1, "#00000000");
    ctxt.fillStyle = gradient;
    fillPolygon(ctxt, [light]);
  });
  await saveCanvasAsFile(canvas, outputPath);

})();
