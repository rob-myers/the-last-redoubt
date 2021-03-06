/**
 * - Usage:
 *   - `yarn render-layout 301`
 *   - `yarn render-layout 301 --debug`
 *   - `yarn render-layout 101 --debug --scale=4`
 *   - `yarn render-layout 301 --scale=1 --suffix=x1`
 * - Outputs a PNG and JSON in public/geomorph.
 * - Debug option creates a .debug.png with all features.
 */
/// <reference path="./deps.d.ts"/>
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import getOpts from 'getopts';

import svgJson from '../../public/symbol/svg.json';
import layoutDefs from '../projects/geomorph/geomorph-layouts';
import { createLayout, deserializeSvgJson, serializeLayout } from '../projects/service/geomorph';
import { renderGeomorph } from '../projects/geomorph/render-geomorph';
import { triangle } from '../projects/service/triangle';
import { saveCanvasAsFile, writeAsJson } from '../projects/service/file';

const geomorphId = Number(process.argv[2]);
const layoutDef = Object.values(layoutDefs).find(x => x.id === geomorphId);
if (!layoutDef) {
  console.error(`No geomorph found with id "${geomorphId}"`);
  process.exit(1);
}

const opts = getOpts(process.argv);
const [debug, scale, suffix, defaultScale] = [opts.debug, opts.scale, opts.suffix, 2];
const publicDir = path.resolve(__dirname, '../../public');
const outputDir = path.resolve(publicDir, 'geomorph');
const outputPath =  path.resolve(outputDir, `${layoutDef.key}${
  debug ? '.debug' : suffix ? `.${suffix}` : ''
}.png`);

(async function run() {
  try {
    const { layout, canvas } = await renderLayout(layoutDef);
    // Also done in svg-meta.js
    const geomorphJsonPath = path.resolve(outputDir, `${layoutDef.key}.json`);
    writeAsJson(serializeLayout(layout), geomorphJsonPath);
    await saveCanvasAsFile(canvas, outputPath);
  } catch (e) {
    console.log('ERROR', e)
  }
})();

/**
 * Compute and render layout, given layout definition.
 * @param {Geomorph.LayoutDef} def
 */
async function renderLayout(def) {

  const canvas = createCanvas(0, 0);
  const symbolLookup = deserializeSvgJson(/** @type {*} */ (svgJson));
  const layout = await createLayout(def, symbolLookup, triangle);

  await renderGeomorph(
    layout,
    symbolLookup,
    canvas,
    (pngHref) => loadImage(fs.readFileSync(path.resolve(publicDir + pngHref))),
    {
      scale: scale || defaultScale,
      obsBounds: true, wallBounds: true, navTris: true,
      ...debug && { doors: true, labels: true }
    },
  );
  return {
    layout,
    canvas,
  };
}
