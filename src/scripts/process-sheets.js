/**
 * Process spritesheets from media/NPC and optionally:
 * - rotate each frame by 0, 90, 180 or 270
 * - shift frames cyclically e.g. so walk starts from idle position
 * Write to static/assets/npc/{npcClassKey}/*
 * 
 * 🚧 optimize + webp
 */
/// <reference path="./deps.d.ts"/>

import childProcess from 'child_process';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

import { runYarnScript } from './service';
import { saveCanvasAsFile } from '../projects/service/file';
import { Mat, Poly, Rect } from '../projects/geom';
import { pause } from '../projects/service/generic';

const mediaDir = path.resolve(__dirname, '../../media');
const staticAssetsDir = path.resolve(__dirname, '../../static/assets');

main();

async function main() {

    // yarn npcs-meta-new
    await runYarnScript('npcs-meta-new');

    // Get generated json
    // const npcsMeta = (await import('../projects/world/npcs-meta-new.json')).default;
    const npcsMeta = require('../projects/world/npcs-meta-new.json');

    // Apply two isomorphisms
    // - rotate each frame by 0, 90, 180 or 270
    // - shift frames cyclically e.g. so walk starts from idle position
    for (const entry of Object.entries(npcsMeta)) {
        const npcClassKey = /** @type {NPC.NpcClassKey} */ (entry[0]);
        const npcClassMeta = /** @type {NPC.NpcMetaJsonNew} */ (entry[1]);
        
        const srcDir = `${mediaDir}/NPC/class/${npcClassKey}`;
        const dstDir = `${staticAssetsDir}/npc/${npcClassKey}`;

        const sheets = fs.readdirSync(srcDir).flatMap(filename => {
            const matched = filename.match(`^${npcClassKey}--(\\S+)\\.png$`);
            return matched ? { filename, animKey: matched[1] } : [];
        });
        // console.log(npcClassKey, sheets);

        for (const { filename, animKey } of sheets) {
            const {
                frameAabb,
                frameCount,
                rotateDeg = 0,
                shiftFramesBy = 0,
            } = npcClassMeta.parsed.animLookup[animKey];
            // media/NPC/class/${npcClassKey}/${npcClassKey}--${animKey}.png
            const image = await loadImage(`${srcDir}/${filename}`);

            const rotFrameAabb = [0, 180].includes(rotateDeg)
                ? new Rect(0, 0, frameAabb.width, frameAabb.height)
                : new Rect(0, 0, frameAabb.height, frameAabb.width);
            const rotImageAabb = new Rect(0, 0, rotFrameAabb.width * frameCount, rotFrameAabb.height);

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
                // - top-left is at (frameId * rotFrameAabb.width, 0)
                // - bottom-left is at ((frameId + 1) * rotFrameAabb.width, rotFrameAabb.height)
                const dstRect = Poly.fromRect(
                    new Rect(frameId * rotFrameAabb.width, 0, rotFrameAabb.width, rotFrameAabb.height)
                ).applyMatrix(inverseMatrix).rect;

                ctxt.drawImage(
                    image,
                    srcFrameId * frameAabb.width, 0, frameAabb.width, frameAabb.height,
                    dstRect.x, dstRect.y, dstRect.width, dstRect.height,
                );
            }
            
            await saveCanvasAsFile(canvas, `${dstDir}/${filename}`);
        }
    }


    // Finally optimize pngs + generate webp
    // 🚧 write to static/asset can break gatsby
    // await Promise.all(Object.keys(npcsMeta).map(
    //     npcClassKey => runYarnScript('minify-pngs', `${staticAssetsDir}/npc/${npcClassKey}`, 'webp')
    // ));
    await Promise.all(Object.keys(npcsMeta).map(
        npcClassKey => runYarnScript('minify-pngs', `${staticAssetsDir}/npc/${npcClassKey}`)
    ));
}
