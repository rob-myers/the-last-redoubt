/**
 * Trim and minify-pngs in directory
 * yarn simplify-pngs {src_dir} [--colors=32] [...]
 * - {src_dir} is relative to repo root
 * - {src_dir} exists
 * - 
 * 
 * Examples
 * - yarn simplify-pngs media/unsorted --colors=32
 * - yarn simplify-pngs static/assets/png --colors=32
 * - yarn simplify-pngs static/assets/symbol --colors=32
 *   > ⛔️ Above should not be run (causes many diffs)
 *   > Instead, trim earlier in directory media/unsorted
 * - yarn simplify-pngs media/symbols-png-staging --colors=32
 */

import fs from 'fs';
import childProcess from 'child_process';
import getopts from 'getopts';
import { uid } from 'uid';
import { error, info } from '../projects/service/log';
import { runYarnScript } from './service';

const [,, srcDir, ...otherArgs] = process.argv;
const opts = getopts(process.argv, { string: ['colors'] });
const colors = opts.colors ? parseInt(opts.colors) : null;

if (!srcDir || !fs.existsSync(srcDir) || !(Number.isInteger(colors) || colors === null)) {
  error(`error: usage: yarn simplify-pngs {src_dir} [--colors=32] [...] where
  - {src_dir} is relative to repo root
  - {src_dir} exists
  `);
  process.exit(1);
}


main();

async function main() {

  info(`applying parallel \`convert\` to directory ${srcDir}`);
  const tempDir = `temp_${uid()}`;
  childProcess.execSync(`
    cd '${srcDir}' && mkdir ${tempDir}
    time find *.png -print0 |
      xargs -0 -I £ -P 40 convert -fuzz 1% -trim ${
        colors ? `-colors ${colors}` : ''
      } £ ./${tempDir}/£
    mv ${tempDir}/*.png . && rmdir ${tempDir}
  `);
  
  // By default quality=100 so idempotent
  await runYarnScript('minify-pngs', srcDir, '--quality=100', ...otherArgs);
}
