/**
 * Create decor spritesheet
 * - `yarn decor-sheet`
 * - inputs /assets/decor/*.svg
 * - outputs /assets/decor/spritesheet.{png,json}
 */
/// <reference path="./deps.d.ts"/>

import fs from 'fs';
import cheerio from 'cheerio';
import { MaxRectsPacker, Rectangle } from "maxrects-packer";
import { createCanvas, loadImage } from 'canvas';

import { ansi } from "../projects/service/const";
import { saveCanvasAsFile, writeAsJson } from '../projects/service/file';
import { assertDefined } from '../projects/service/generic';
import { runYarnScript } from './service';

const decorSvgsFolder = 'static/assets/decor';
const outputPngPath = `${decorSvgsFolder}/spritesheet.png`;
const outputJsonPath = `${decorSvgsFolder}/spritesheet.json`;
const packedPadding = 2;
const rectsToPack = /** @type {import("maxrects-packer").Rectangle[]} */ ([]);
const imageDim = 128;
const canvas = createCanvas(1, 1);
const ctxt = canvas.getContext('2d');

(async function main() {

  const files = fs.readdirSync(decorSvgsFolder).filter(x => x.endsWith('.svg'));

  // Infer spritesheet packing
  const packer = new MaxRectsPacker(4096, 4096, packedPadding, {
    pot: false,
    border: packedPadding,
    // smart: false,
  });
  for (const filename of files) {
    addRectToPack(imageDim, imageDim, filenameToKey(filename));
  }
  packer.addArray(rectsToPack);
  const { bins } = packer;
  if (bins.length !== 1) {
    throw Error(`spine-meta: expected exactly one bin (${bins.length})`);
  } else if (bins[0].rects.length !== rectsToPack.length) {
    throw Error(
      `decor-sheet: expected every file to be packed (${bins.length} of ${rectsToPack.length})`
    );
  }

  const bin = bins[0];
  const packedWidth = bin.width;
  const packedHeight = bin.height;
  canvas.width = packedWidth;
  canvas.height = packedHeight;

  // Create JSON
  const json = /** @type {NPC.DecorSpriteSheet} */ ({ lookup: {} });
  bin.rects.forEach(r => json.lookup[/** @type {NPC.DecorPointClassKey} */ (r.data.name)] = {
    name: r.data.name,
    x: r.x, y: r.y, width: r.width, height: r.height,
  });
  writeAsJson(json, outputJsonPath);

  // Create PNG, WEBP
  for (const filename of files) {
    const rect = assertDefined(bin.rects.find((x) => x.data.name === filenameToKey(filename)));

    // transform SVG to specified dimension
    const svgContents = fs.readFileSync(`${decorSvgsFolder}/${filename}`).toString();
    const $ = cheerio.load(svgContents);
    const svgEl = $('svg').first();
    svgEl.attr('width', `${imageDim}`);
    svgEl.attr('height', `${imageDim}`);
    const transformedSvgContents = svgEl.toString();

    // draw image via data url
    const dataUrl = `data:image/svg+xml;utf8,${transformedSvgContents}`;
    const image = await loadImage(dataUrl);
    ctxt.drawImage(image, rect.x, rect.y);
  }
  await saveCanvasAsFile(canvas, outputPngPath);
  await runYarnScript('pngs-to-webp', outputPngPath);

})();

/** @param {number} width @param {number} height @param {string} name */
function addRectToPack(width, height, name) {
  console.log(`${ansi.Blue}will pack${ansi.Reset}:`, name, { width, height });
  const r = new Rectangle(width, height);
  r.data = { name };
  rectsToPack.push(r);
}

/**
 * e.g. `foo.svg` -> `foo`
 * @param {string} filename 
 */
function filenameToKey(filename) {
  return filename.split('.').slice(0, -1).join('.');
}
