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
import { gmScale } from '../projects/world/const';
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

const defaultScale = gmScale;

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
     * 🌙 Draw UNLIT geomorph.
     */
    const { layout, canvas } = await renderLayout(foundLayoutDef, {
      debug: !!debug,
      thinDoors: false,
      scale,
      invertSymbols: true,
      darken: true, // Darken in same way as lit geomorph
      arrows: false,
      hullDoorBases: true,
    });

    /**
     * 🧭 Draw MAP geomorph with doors, no highlights and no `extra--*`s.
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
        floorColor: 'rgba(180, 180, 180, 1)',
        navColor: 'rgba(200, 200, 200, 1)',
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
 * @param {Geomorph.RenderOpts & { debug: boolean }} opts
 */
export async function renderLayout(def, {
  darken = false,
  debug,
  arrows = false,
  invertSymbols = false,
  scale = defaultScale,
  ...opts
}) {
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

      ...opts.thinDoors && {
        doors: true,
      },
      ...debug && {
        doors: true,
        labels: true,
      },

      arrows,
      darken,
      invertSymbols,
      ...opts,
    },
  );
  return {
    layout,
    canvas,
    pngRect: symbolLookup[layout.items[0].key].pngRect,
  };
}
