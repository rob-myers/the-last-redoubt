/**
 * Process spritesheets from media/NPC:
 * - can rotate each frame by 0, 90, 180 or 270
 * - can shift frames cyclically e.g. so walk starts from idle position
 *
 * 🚧 Read media/NPC/class/{npcClassKey}/spriter_man_01_base_{animKey}
 * Write to static/assets/npc/{npcClassKey}/*
 */
/// <reference path="./deps.d.ts"/>

import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

import { runYarnScript } from './service';
import { saveCanvasAsFile } from '../projects/service/file';
import { Mat, Poly, Rect } from '../projects/geom';
import { batchExportPrefix, spriterEntityName } from './npcs-config';

const mediaDir = path.resolve(__dirname, '../../media');
const staticAssetsDir = path.resolve(__dirname, '../../static/assets');

main();

async function main() {

    // yarn npcs-meta
    await runYarnScript('npcs-meta');

    console.log('👁')

    // Get generated json
    // Dynamic import (or require) provides inferred types (unlike readFile)
    const npcsMeta = (await import('../projects/world/npcs-meta.json')).default;

    // Apply two isomorphisms
    // - rotate each frame by 0, 90, 180 or 270
    // - shift frames cyclically e.g. so walk starts from idle position
    for (const entry of Object.entries(npcsMeta)) {
        const npcClassKey = /** @type {NPC.NpcClassKey} */ (entry[0]);
        const npcClassMeta = /** @type {NPC.NpcClassJson} */ (entry[1]);
        
        const srcDir = `${mediaDir}/NPC/class/${npcClassKey}`;
        const dstDir = `${staticAssetsDir}/npc/${npcClassKey}`;
        fs.mkdirSync(dstDir, { recursive: true }); // ensure dst directory

        const sheets = fs.readdirSync(srcDir).flatMap(filename => {
            // const matched = filename.match(`^${npcClassKey}--(\\S+)\\.png$`);
            const matched = filename.match(`^${batchExportPrefix}_${spriterEntityName}_(\\S+)\\.png$`);
            return matched ? { filename, animKey: matched[1] } : [];
        });
        console.log(npcClassKey, sheets);

        for (const { filename, animKey } of sheets) {
            if (!(animKey in npcClassMeta.parsed.animLookup)) {
                continue; // Skip un-configured animations
            }

            const {
                frameAabbOrig,
                frameAabb, // rotateDeg is already applied to frameAabb
                frameCount,
                rotateDeg = 0,
                shiftFramesBy = 0,
            } = npcClassMeta.parsed.animLookup[animKey];

            //  media/NPC/class/${npcClassKey}/${npcClassKey}--${animKey}.png
            //  media/NPC/class/${npcClassKey}/${batchExportPrefix}_${spriterEntityName}_${animKey}.png
            const image = await loadImage(`${srcDir}/${filename}`);

            const rotImageAabb = new Rect(0, 0, frameAabb.width * frameCount, frameAabb.height);

            const canvas = createCanvas(rotImageAabb.width, rotImageAabb.height);
            const ctxt = canvas.getContext('2d');

            const rotateRad = (rotateDeg / 180) * Math.PI;
            const rotMatrix = new Mat([
                Math.cos(rotateRad), Math.sin(rotateRad),
                -Math.sin(rotateRad), Math.cos(rotateRad),
                0, 0,
            ]);
            const inverseMatrix = rotMatrix.getInverseMatrix();
            ctxt.setTransform(rotMatrix.a, rotMatrix.b, rotMatrix.c, rotMatrix.d, 0, 0);

            for (let frameId = 0; frameId < frameCount; frameId++) {
                // imagewise roll
                let srcFrameId = (frameId + shiftFramesBy) % frameCount;
                (srcFrameId < 0) && (srcFrameId += frameCount);

                // framewise rotation
                // ℹ️ Choose dstRect such that, if we apply matrix rot(angle) to dstRect,
                // we will produce a rectangle where:
                // - top-left is at (frameId * frameAabb.width, 0)
                // - bottom-left is at ((frameId + 1) * frameAabb.width, frameAabb.height)
                const dstRect = Poly.fromRect(
                    new Rect(frameId * frameAabb.width, 0, frameAabb.width, frameAabb.height)
                ).applyMatrix(inverseMatrix).rect;

                ctxt.drawImage(
                    image,
                    srcFrameId * frameAabbOrig.width, 0, frameAabbOrig.width, frameAabbOrig.height,
                    dstRect.x, dstRect.y, dstRect.width, dstRect.height,
                );
            }
            
            const outputFilename = `${npcClassKey}--${animKey}.png`;
            await saveCanvasAsFile(canvas, `${dstDir}/${outputFilename}`);
        }
    }

    // Finally, optimize pngs + generate webp
    await Promise.all(Object.keys(npcsMeta).map(
        npcClassKey => runYarnScript(
            'minify-pngs',
            `${staticAssetsDir}/npc/${npcClassKey}`,
            '--webp=75',
        )
    ));
}
