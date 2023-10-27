import { loadImage } from "./dom";

/**
 * Client-side only.
 */
class ImageService {

  hrefs = /** @type {const} */ ([
    "/assets/icon/circle-right.invert.svg",
    "/assets/icon/standing-person.png",
    "/assets/icon/sitting-silhouette.invert.svg",
    "/assets/icon/lying-man.invert.svg",
    "/assets/icon/info-icon.invert.svg",
    "/assets/icon/road-works.invert.svg",
  ]);

  lookup = /** @type {Record<ImageServiceHref, HTMLImageElement>} */ ({});

  async load() {
    const els = await Promise.all(this.hrefs.map(href => loadImage(href)))
    els.forEach((el, i) => this.lookup[this.hrefs[i]] = el);
  }
}

export const imageService = new ImageService;

/**
 * @typedef {ImageService['hrefs'][*]} ImageServiceHref
 */