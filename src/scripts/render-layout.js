/**
 * - We output geomorph with thin doors png/webp, and also unlit.doorways,
 *   the latter being used for lighting.
 * - Usage:
 *   - `yarn render-layout 301`
 *   - `yarn render-layout 301 --debug`
 *   - `yarn render-layout 101 --debug --scale=4`
 *   - `yarn render-layout 301 --scale=1 --suffix=x1`
 * - Outputs a PNG and JSON in static/assets/geomorph.
 * - Debug option creates a .debug.png with all features.
 */
/// <reference path="./deps.d.ts"/>
import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';
import { createCanvas, loadImage } from 'canvas';
import getOpts from 'getopts';

import svgJson from '../../static/assets/symbol/svg.json';
import layoutDefs from '../projects/geomorph/geomorph-layouts';
import { error } from '../projects/service/log';
import { createLayout, deserializeSvgJson, serializeLayout } from '../projects/service/geomorph';
import { drawThinDoors, renderGeomorph } from '../projects/geomorph/render-geomorph';
import { triangle } from '../projects/service/triangle';
import { saveCanvasAsFile, writeAsJson } from '../projects/service/file';

const geomorphId = Number(process.argv[2]);
const layoutDef = Object.values(layoutDefs).find(x => x.id === geomorphId);
if (!layoutDef) {
  console.error(`No geomorph found with id "${geomorphId}"`);
  process.exit(1);
}
const foundLayoutDef = layoutDef; // else ts error in main

const opts = getOpts(process.argv);
const defaultScale = 2;
const [
  debug,
  scale,
  suffix,
] = [!!opts.debug, opts.scale = defaultScale, !!opts.suffix];
const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const outputDir = path.resolve(staticAssetsDir, 'geomorph');
const outputPngPath =  path.resolve(outputDir, `${layoutDef.key}${
  debug ? '.debug' : suffix ? `.${suffix}` : ''
}.png`);

main();

async function main() {
  try {
    // Draw geomorph with thin doors, and also unlit.doorways
    const { layout, canvas, pngRect } = await renderLayout(foundLayoutDef, { thinDoors: false, debug: !!debug, scale});
    const unlitDoorwaysCanvas = createCanvas(canvas.width, canvas.height);
    layout.doors.forEach(({ rect }) => {
      // Outset and integral-valued for precision canvas drawImage later
      rect = rect.clone().precision(0).outset(1);
      unlitDoorwaysCanvas.getContext('2d').drawImage(canvas, scale * (rect.x - pngRect.x), scale * (rect.y - pngRect.y), scale * rect.width, scale * rect.height, scale * (rect.x - pngRect.x), scale * (rect.y - pngRect.y), scale * rect.width, scale * rect.height)
    });
    drawThinDoors(canvas.getContext('2d'), layout);

    // Write JSON (see also svg-meta)
    const geomorphJsonPath = path.resolve(outputDir, `${foundLayoutDef.key}.json`);
    writeAsJson(serializeLayout(layout), geomorphJsonPath);

    // For both geomorph and unlit.doorways,
    // save PNG, WEBP, and finally Optimize PNG
    for (const { srcCanvas, dstPngPath } of [
      { srcCanvas: canvas, dstPngPath: outputPngPath },
      { srcCanvas: unlitDoorwaysCanvas, dstPngPath: outputPngPath.replace(/^(.*)\.png$/, '$1.unlit.doorways.png') },
    ]) {
      await saveCanvasAsFile(srcCanvas, dstPngPath);
      childProcess.execSync(`cwebp ${dstPngPath} -o ${dstPngPath.replace(/^(.*)\.png$/, '$1.webp')}`);
      childProcess.execSync(`pngquant -f --quality=80 ${dstPngPath} && mv ${dstPngPath.replace(/\.png$/, '-fs8.png')} ${dstPngPath}`);
    }
  } catch (e) {
    error(e);
  }
};

/**
 * Compute and render layout, given layout definition.
 * @param {Geomorph.LayoutDef} def
 * @param {{ thinDoors: boolean; debug: boolean; scale?: number}} opts
 */
export async function renderLayout(def, { thinDoors, debug, scale = defaultScale }) {

  const canvas = createCanvas(0, 0);
  const symbolLookup = deserializeSvgJson(/** @type {*} */ (svgJson));
  const layout = await createLayout(def, symbolLookup, triangle);
  const staticDir = path.resolve(__dirname, '../../static');

  await renderGeomorph(
    layout,
    symbolLookup,
    canvas,
    (pngHref) => loadImage(fs.readFileSync(path.resolve(staticDir + pngHref))),
    {
      scale,
      obsBounds: true,
      wallBounds: true,
      navTris: true,

      doors: false,
      ...thinDoors && {
        doors: true,
      },
      ...debug && {
        doors: true,
        labels: true,
      },
    },
  );
  return {
    layout,
    canvas,
    pngRect: symbolLookup[layout.items[0].key].pngRect,
  };
}
