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
import * as npcService from '../projects/service/npc';

const [,, npcName, ...animNames] = process.argv;
const npcInputDir = 'static/assets/npc'
const npcSvgFilepath = path.resolve(npcInputDir, npcName + '.svg');
if (!npcName || !fs.existsSync(npcSvgFilepath)) {
  error(`error: usage: yarn render-npc {npc-name} {...anim-name-0} ... where
    - static/assets/npc/{npc-name}.svg exists
  `);
  process.exit(1);
}

const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const npcOutputDir = path.resolve(staticAssetsDir, 'npc');
const svgContents = fs.readFileSync(npcSvgFilepath).toString();

const zoom = 2;
const parsed = npcService.parseNpc(npcName, svgContents, zoom);
npcService.renderNpcSpriteSheets(parsed, npcOutputDir, { zoom, animNames });

/** @type {NPC.ParsedNpc} */
const serializable = {
  ...parsed,
  animLookup: mapValues(
    parsed.animLookup,
    ({ defsNode, frameNodes, ...rest }) => rest,
  ),
};

writeAsJson(serializable, path.resolve(npcOutputDir, npcName + '.json'));
