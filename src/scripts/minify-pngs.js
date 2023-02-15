/**
 * yarn minify-pngs {src_dir} [webp]
 * - {src_dir} is relative to repo root
 * - {src_dir} must exist
 * - option additionally generates webp files
 *
 * Examples:
 * - yarn minify-pngs static/assets/pics
 * - yarn minify-pngs media/geomorph-edge
 * - yarn minify-pngs static/assets/geomorph
 * - yarn minify-pngs static/assets/symbol
 *   > maybe better to do `yarn simplify-pngs static/assets/symbol`
 * - yarn minify-pngs static/assets/npc/first-human-npc
 */
import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';
import { error, info } from '../projects/service/log';

const [,, srcDir, extra] = process.argv;
if (!srcDir || !fs.existsSync(srcDir) || (extra && (extra !== 'webp'))) {
  error(`error: usage: yarn minify-pngs {src_dir} [webp] where
    - {src_dir} is relative to repo root
    - {src_dir} exists
  `);
  process.exit(1);
}
//#region optipng
// https://tinypng.com/ was often much better.
// if (childProcess.execSync(`optipng --version | grep OptiPNG  >/dev/null && echo $?`).toString().trim() !== '0') {
//   error("error: please install optipng e.g. `brew install optipng`");
//   process.exit(1);
// }

// info(`applying parallel \`optipng\` to directory ${srcDir}`);
// childProcess.execSync(`
//   time find ${path.join(`'${srcDir}'`, '*.png')} -print0 |
//     xargs -0 -n 1 -P 20 optipng
// `);
//#endregion

// Create webp files first
if (extra === 'webp') {
  childProcess.execSync('yarn pngs-to-webp')
}

//#region pngquant
if (childProcess.execSync(`pngquant --help | grep pngquant  >/dev/null && echo $?`).toString().trim() !== '0') {
  error("error: please install pngquant e.g. `brew install pngquant`");
  process.exit(1);
}

info(`applying parallel \`pngquant\` to directory ${srcDir}`);
childProcess.execSync(`
  time find ${path.join(`'${srcDir}'`, '*.png')} -print0 |
    xargs -0 -n 1 -P 20 pngquant -f --quality=80
`);

for (const fileName of fs.readdirSync(srcDir).filter(x => x.endsWith('-fs8.png'))) {
  const filePath = path.resolve(srcDir, fileName);
  fs.renameSync(filePath, filePath.replace( /^(.*)(-fs8)\.png$/, '$1.png'));
}
//#endregion

