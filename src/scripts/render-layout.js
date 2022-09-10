/**
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
import { createCanvas, loadImage } from 'canvas';
import getOpts from 'getopts';

import svgJson from '../../static/assets/symbol/svg.json';
import layoutDefs from '../projects/geomorph/geomorph-layouts';
import { error } from '../projects/service/log';
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
const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const outputDir = path.resolve(staticAssetsDir, 'geomorph');
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
    error(e);
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
  const staticDir = path.resolve(__dirname, '../../static');

  await renderGeomorph(
    layout,
    symbolLookup,
    canvas,
    (pngHref) => loadImage(fs.readFileSync(path.resolve(staticDir + pngHref))),
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
