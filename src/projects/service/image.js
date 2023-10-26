import { loadImage } from "./dom";

/**
 * Client-side only.
 */
class ImageService {

  hrefs = /** @type {const} */ ([
    "/assets/icon/circle-right.png",
    "/assets/icon/standing-person.png",
    "/assets/icon/sitting-silhouette.png",
    "/assets/icon/lying-man-posture-silhouette.png",
    "/assets/icon/info-icon.png",
    "/assets/icon/road-works.png",
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