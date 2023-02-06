/**
 * - Usage:
 *   - `yarn render-layout 301`
 *   - `yarn render-layout 301 --doors`
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
import { renderGeomorph } from '../projects/geomorph/render-geomorph';
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
const [
  doors,
  debug,
  scale,
  suffix,
  defaultScale,
] = [opts.doors, opts.debug, opts.scale, opts.suffix, 2];
const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const outputDir = path.resolve(staticAssetsDir, 'geomorph');
const outputPngPath =  path.resolve(outputDir, `${layoutDef.key}${
  debug ? '.debug' : suffix ? `.${suffix}` : ''
}.png`);

main();

async function main() {
  try {
    // Do the rendering
    const { layout, canvas } = await renderLayout(foundLayoutDef, { doors, debug: !!debug, scale});
    // Write JSON (also done in svg-meta)
    const geomorphJsonPath = path.resolve(outputDir, `${foundLayoutDef.key}.json`);
    writeAsJson(serializeLayout(layout), geomorphJsonPath);

    // Save PNG
    await saveCanvasAsFile(canvas, outputPngPath);
    // Generate WEBP
    childProcess.execSync(`cwebp ${outputPngPath} -o ${outputPngPath.replace(/^(.*)\.png$/, '$1.webp')}`);
    // Minify PNG
    childProcess.execSync(`pngquant -f --quality=80 ${outputPngPath} && mv ${outputPngPath.replace(/\.png$/, '-fs8.png')} ${outputPngPath}`);
  } catch (e) {
    error(e);
  }
};

/**
 * Compute and render layout, given layout definition.
 * @param {Geomorph.LayoutDef} def
 * @param {{ doors: boolean; debug: boolean; scale?: number}} opts
 */
export async function renderLayout(def, { doors, debug, scale = defaultScale }) {

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
      obsBounds: true, wallBounds: true, navTris: true,
      doors,
      ...debug && {
        doors: true,
        labels: true,
      },
    },
  );
  return {
    layout,
    canvas,
  };
}
