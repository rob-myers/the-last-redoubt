import fs from 'fs';
import stream from 'stream/promises';
import { Canvas } from "canvas";
import stringify from 'json-stringify-pretty-compact';

/**
 * @param {Canvas} canvas 
 * @param {string} outputPath 
 */
export async function saveCanvasAsFile(canvas, outputPath) {
  return stream.pipeline(
    canvas.createPNGStream(), 
    fs.createWriteStream(outputPath),
  );
}

/**
 * @param {object} serializable A javascript object to be serialized
 * @param {string} jsonPath 
 */
export function writeAsJson(serializable, jsonPath) {
  return fs.writeFileSync(
    jsonPath,
    stringify(serializable),
  );
}
