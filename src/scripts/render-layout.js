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
import { renderGeomorph } from '../projects/geomorph/render-geomorph';
import { triangle } from '../projects/service/triangle';
import { saveCanvasAsFile, writeAsJson } from '../projects/service/file';
import { runYarnScript } from './service';

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
const outputPngFilename = `${layoutDef.key}${
  debug ? '.debug' : suffix ? `.${suffix}` : ''
}.png`;

const symbolLookup = deserializeSvgJson(/** @type {*} */ (svgJson));
const staticDir = path.resolve(__dirname, '../../static');

(async function main() {
  try {
    /**
     * Draw unlit geomorph.
     */
    const { layout, canvas } = await renderLayout(foundLayoutDef, {
      thinDoors: false,
      debug: !!debug,
      scale,
      invertSymbols: true,
    });

    /**
     * Draw map geomorph with doors, no highlights and no `extra--*`s.
     */
    const mapCanvas = createCanvas(canvas.width, canvas.height);
    layout.items = layout.items.filter(x => !x.key.startsWith('extra--'));

    await renderGeomorph(
      layout,
      symbolLookup,
      mapCanvas,
      (pngHref) => /** @type {Promise<import('canvas').Image & CanvasImageSource>} */ (
        loadImage(fs.readFileSync(path.resolve(staticDir + pngHref)))
      ),
      {
        scale,
        obsBounds: false,
        wallBounds: true,
        navTris: false,
        navOutline: false,
        doors: true,
        labels: false, // otherwise e.g. they'd be reflected with geomorph
        highlights: false,
      },
    );

    // Write JSON (see also svg-meta)
    const geomorphJsonPath = path.resolve(outputDir, `${foundLayoutDef.key}.json`);
    writeAsJson(serializeLayout(layout), geomorphJsonPath);

    /**
     * For both geomorph and map,
     * save PNG, WEBP, and finally Optimize PNG.
     * Using temp dir avoids breaking gatsby (watching static/assets)
     */
    const tempDir = fs.mkdtempSync('pngquant-');
    await saveCanvasAsFile(canvas, `${tempDir}/${outputPngFilename}`);
    await saveCanvasAsFile(mapCanvas, `${tempDir}/${outputPngFilename.slice(0, -3)}map.png`);
    await runYarnScript('minify-pngs', tempDir, '--webp', '--quality=90');
    childProcess.execSync(`cp ${tempDir}/* ${outputDir}`);
    fs.rmSync(tempDir, { force: true, recursive: true });
  } catch (e) {
    error(e);
  }
})();

/**
 * Compute and render layout, given layout definition.
 * @param {Geomorph.LayoutDef} def
 * @param {{ thinDoors: boolean; debug: boolean; scale?: number; invertSymbols?: boolean; }} opts
 */
export async function renderLayout(def, { thinDoors, debug, scale = defaultScale, invertSymbols = false }) {
  const canvas = createCanvas(0, 0);

  const layout = await createLayout({
    def,
    lookup: symbolLookup,
    triangleService: triangle,
  });

  await renderGeomorph(
    layout,
    symbolLookup,
    canvas,
    (pngHref) => /** @type {Promise<import('canvas').Image & CanvasImageSource>} */ (
      loadImage(fs.readFileSync(path.resolve(staticDir + pngHref)))
    ),
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
      invertSymbols,
    },
  );
  return {
    layout,
    canvas,
    pngRect: symbolLookup[layout.items[0].key].pngRect,
  };
}
