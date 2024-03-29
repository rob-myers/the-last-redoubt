/**
 * - Parse every svg symbol in /static/assets/symbol
 * - Write as a single json file /static/assets/symbol/svg.json
 * - Update any changed /static/assets/geomorph/{geomorph}.json
 *
 * Usage:
 * - `yarn svg-meta`
 * - `yarn svg-meta --all`
 */
/// <reference path="./deps.d.ts"/>

import fs from 'fs';
import path from 'path';
import getOpts from 'getopts';
import asyncPool from 'tiny-async-pool';
import chalk from 'chalk';

import { svgSymbolTag } from '../projects/service/const';
import { deepClone, keys } from '../projects/service/generic';
import { createLayout, deserializeSvgJson, filterSingles, parseStarshipSymbol, serializeLayout, serializeSymbol } from '../projects/service/geomorph';
import { triangle } from '../projects/service/triangle';
import { writeAsJson } from '../projects/service/file';
import layoutDefs from '../projects/geomorph/geomorph-layouts';

const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const symbolsDir = path.resolve(staticAssetsDir, 'symbol');
const geomorphsDir = path.resolve(staticAssetsDir, 'geomorph');
const svgFilenames = fs.readdirSync(symbolsDir).filter(x => x.endsWith('.svg'));
const svgJsonFilename = path.resolve(symbolsDir, `svg.json`)

const opts = getOpts(process.argv);
const [updateAllGeomorphJsons] = [opts.all];

const svgJsonLookup = /** @type {Record<Geomorph.SymbolKey, Geomorph.ParsedSymbol<Geom.GeoJsonPolygon>>} */ ({});
let prevSvgJsonLookup = /** @type {null | typeof svgJsonLookup} */ (null);
if (fs.existsSync(svgJsonFilename)) {
  prevSvgJsonLookup = JSON.parse(fs.readFileSync(svgJsonFilename).toString());
}

for (const filename of svgFilenames) {
  const symbolName = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -'.svg'.length));
  const filepath = path.resolve(symbolsDir, filename);
  const contents = fs.readFileSync(filepath).toString();
  const lastModified = fs.statSync(filepath).mtimeMs;
  const parsed = serializeSymbol(parseStarshipSymbol(
    symbolName,
    contents,
    lastModified,
  ));
  svgJsonLookup[symbolName] = parsed;
}

const changedSymbols = keys(svgJsonLookup).filter((symbolName) =>
  !prevSvgJsonLookup ||
  !(symbolName in prevSvgJsonLookup) ||
  prevSvgJsonLookup[symbolName].lastModified !== svgJsonLookup[symbolName].lastModified
);
const changedLightsSymbols = keys(svgJsonLookup).filter((symbolName) => {
  const lights = filterSingles(svgJsonLookup[symbolName].singles, svgSymbolTag.light);
  const prevLights = prevSvgJsonLookup?.[symbolName] ? filterSingles(prevSvgJsonLookup[symbolName].singles, svgSymbolTag.light) : [];
  return lights.length && (
    !prevSvgJsonLookup?.[symbolName] || (
      prevSvgJsonLookup[symbolName].lastModified !== svgJsonLookup[symbolName].lastModified &&
      JSON.stringify(prevLights) !== JSON.stringify(lights)
    )
  );
});
const changedLayoutDefs = Object.values(layoutDefs).filter(def => {
  const usedSymbols = def.items.map(x => x.id);
  return changedSymbols.some(symbolName => usedSymbols.includes(symbolName));
});

console.log({
  changedSymbols,
  changedLayoutDefs,
  changedLightsSymbols, // 🚧 trigger bake-lighting?
});

(async function writeChangedGeomorphJsons () {
  const symbolLookup = deserializeSvgJson(svgJsonLookup);
  const layoutDefsToUpdate = updateAllGeomorphJsons ? Object.values(layoutDefs) : changedLayoutDefs;
  
  asyncPool(
    1, // One at a time aids debugging
    layoutDefsToUpdate.map(def => {
      /** Avoid def.items being mutated by inner symbols */
      const clonedDef = deepClone(def);
      return async () => {
        console.log(chalk.blue('creating layout'), chalk.yellow(def.key), '...');
        const layout = await createLayout({ def: clonedDef, lookup: symbolLookup, triangleService: triangle });
        const filename = path.resolve(geomorphsDir, `${def.key}.json`);
        console.log(chalk.blue('writing'), chalk.yellow(filename), '...');
        writeAsJson(serializeLayout({...layout, def }), filename);
      };
    }),
    action => action(),
  );

})();

// Finally, write svg.json
writeAsJson(svgJsonLookup, svgJsonFilename);
