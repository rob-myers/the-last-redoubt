/**
 * yarn pngs-to-webp {src_dir}
 * - {src_dir} is relative to repo root
 * - {src_dir} must exist
*
 * Examples:
 * - yarn pngs-to-webp static/assets/geomorph
 * - yarn pngs-to-webp static/assets/npc/first-human-npc
 * - yarn pngs-to-webp static/assets/icon
 */
import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';
import { error, info } from '../projects/service/log';

const [,, srcDir, extra] = process.argv;
if (!srcDir || !fs.existsSync(srcDir)) {
  error(`error: usage: yarn pngs-to-webp {src_dir} where
    - {src_dir} is relative to repo root
    - {src_dir} exists
  `);
  process.exit(1);
}

if (childProcess.execSync(`cwebp -version >/dev/null && echo $?`).toString().trim() !== '0') {
  error("error: please install cwebp e.g. `brew install webp`");
  process.exit(1);
}

info(`applying parallel \`cwebp\` to directory ${srcDir}`);
// Use temp dir because gatsby watches static/assets/**/* and
// sometimes breaks when we rename files there
const tempDir = fs.mkdtempSync('cwebp-');

childProcess.execSync(`cp ${path.join(`'${srcDir}'`, '*.png')} ${tempDir}`);
// cwebp first-human-npc--walk.png -o first-human-npc--walk.webp
childProcess.execSync(`
  time find ${path.join(`'${tempDir}'`, '*.png')} -print0 |
    xargs -0 -I{} -n 1 -P 3 cwebp -noasm "{}" -o "{}".webp
`);

// .png.webp -> .webp
for (const fileName of fs.readdirSync(tempDir).filter(x => x.endsWith('.png.webp'))) {
  const filePath = path.resolve(tempDir, fileName);
  fs.renameSync(filePath, filePath.replace( /^(.*)(\.png)\.webp$/, '$1.webp'));
}
childProcess.execSync(`cp ${path.join(`'${tempDir}'`, '*.png')} ${srcDir}`);
fs.rmSync(tempDir, { force: true, recursive: true });
