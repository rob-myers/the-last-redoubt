import { loadImage } from "./dom";

/**
 * Client-side only.
 */
class ImageService {

  ctxtPool = /** @type {CanvasRenderingContext2D[]} */ ([]);

  hrefs = /** @type {const} */ ([
    "/assets/icon/circle-right.invert.svg",
    "/assets/icon/standing-person.png",
    "/assets/icon/sitting-silhouette.invert.svg",
    "/assets/icon/lying-man.invert.svg",
    "/assets/icon/info-icon.invert.svg",
    "/assets/icon/road-works.invert.svg",
  ]);

  lookup = /** @type {Record<ImageServiceHref, HTMLImageElement>} */ ({});
  
  /**
   * @param {...CanvasRenderingContext2D} ctxts
   */
  freeCtxts(...ctxts) {
    ctxts.forEach(ctxt => {
      ctxt.canvas.width = ctxt.canvas.height = 0;
      this.ctxtPool.push(ctxt);
    });
  }
  /**
   * Allocate canvas context and initialize it.
   * @param {[number, number] | Exclude<CanvasImageSource, SVGImageElement | VideoFrame>} input 
   */
  getCtxt(input) {
    const ctxt = this.ctxtPool.pop() ?? /** @type {CanvasRenderingContext2D} */ (
      document.createElement('canvas').getContext('2d')
    );
    if (Array.isArray(input)) {
      [ctxt.canvas.width, ctxt.canvas.height] = input;
    } else {
      ctxt.canvas.width = input.width;
      ctxt.canvas.height = input.height;
      ctxt.drawImage(input, 0, 0);
    }
    return ctxt;
  }

  async loadRequiredAssets() {
    const els = await Promise.all(this.hrefs.map(href => loadImage(href)))
    els.forEach((el, i) => this.lookup[this.hrefs[i]] = el);
  }

}

export const imageService = new ImageService;

/**
 * @typedef {ImageService['hrefs'][*]} ImageServiceHref
 */