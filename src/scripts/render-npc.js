/// <reference path="./deps.d.ts"/>
/**
 * yarn render-npc {npc-name}
 * yarn render-npc {npc-name} {anim-name-0} ...
 * 
 * Examples:
 * - yarn render-npc first-npc
 * - yarn render-npc first-npc idle
 */
import path from 'path';
import fs from 'fs';
import { writeAsJson } from '../projects/service/file';
import { error } from '../projects/service/log';
import { mapValues } from '../projects/service/generic';
import { parseNpc, renderNpcSpriteSheets } from '../projects/service/npc';

const [,, npcName, ...animNames] = process.argv;
const npcInputDir = 'public/npc'
const npcSvgFilepath = path.resolve(npcInputDir, npcName + '.svg');
if (!npcName || !fs.existsSync(npcSvgFilepath)) {
  error(`error: usage: yarn render-npc {npc-name} {...anim-name-0} ... where
    - media/npc/{npc-name}.svg exists
  `);
  process.exit(1);
}

const publicDir = path.resolve(__dirname, '../../public');
const npcOutputDir = path.resolve(publicDir, 'npc');
const svgContents = fs.readFileSync(npcSvgFilepath).toString();

const zoom = 2;
const parsed = parseNpc(npcName, svgContents, zoom);
renderNpcSpriteSheets(parsed, npcOutputDir, { zoom, animNames });

/** @type {ServerTypes.ParsedNpc} */
const serializable = {
  ...parsed,
  animLookup: mapValues(
    parsed.animLookup,
    ({ defsNode, frameNodes, ...rest }) => rest,
  ),
};

writeAsJson(serializable, path.resolve(npcOutputDir, npcName + '.json'));
