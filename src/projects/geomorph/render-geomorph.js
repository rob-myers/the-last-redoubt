/* eslint-disable no-unused-expressions */
import { Poly, Vect } from "../geom";
import { geom } from '../service/geom';
import { labelMeta, singlesToPolys, drawTriangulation } from '../service/geomorph';
import { error } from "../service/log";
import { drawLine, fillPolygons, fillRing, setStyle } from '../service/dom';

/**
 * Render a single geomorph PNG,
 * optionally with e.g. doors.
 * @param {Geomorph.ParsedLayout} layout
 * @param {Geomorph.SymbolLookup} lookup
 * @param {Canvas} canvas
 * @param {(pngHref: string) => Promise<Image>} getPng
 * `pngHref` has local url format `/symbol/foo`
 * @param {Geomorph.RenderOpts} opts
 */
export async function renderGeomorph(
  layout,
  lookup,
  canvas,
  getPng,
  {
    scale,
    obsBounds = true,
    wallBounds = true,
    navTris = false,
    doors = false,
    thinDoors = false,
    labels = false,
    floorColor = 'rgba(180, 180, 180, 1)',
    navColor = 'rgba(200, 200, 200, 1)',
    navStroke = 'rgba(0, 0, 0, 0.25)',
    obsColor = 'rgba(100, 100, 100, 0.45)',
    // wallColor = 'rgba(50, 40, 40, 0.5)',
    wallColor = 'rgba(50, 40, 40, 1)',
  },
) {
  const hullSym = lookup[layout.items[0].key];
  const pngRect = hullSym.pngRect;
  canvas.width = pngRect.width * scale;
  canvas.height = pngRect.height * scale;

  const ctxt = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctxt.setTransform(scale, 0, 0, scale, -scale * pngRect.x, -scale * pngRect.y);

  ctxt.imageSmoothingEnabled = true;
  ctxt.imageSmoothingQuality = 'high';
  ctxt.lineJoin = 'round';

  //#region underlay
  ctxt.fillStyle = floorColor;
  if (hullSym.hull.length === 1 && hullSym.hull[0].holes.length) {
    const hullOutline = hullSym.hull[0].outline;
    fillRing(ctxt, hullOutline);
  } else {
    error('hull walls must exist, be connected, and have a hole');
  }

  ctxt.fillStyle = navColor;
  ctxt.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  fillPolygons(ctxt, layout.navPoly, true);

  if (navTris) {
    ctxt.strokeStyle = navStroke;
    ctxt.lineWidth = 0.2;
    drawTriangulation(ctxt, layout.navZone)
  }

  const { singles, obstacles, walls } = layout.groups;
  const doorPolys = singlesToPolys(singles, 'door');

  ctxt.lineJoin = 'round';

  if (obsBounds) {
    /**
     * Draw light grey under obstacles
     * Draw drop-shadow i.e. basic 3d effect
     */
    ctxt.fillStyle = obsColor;
    ctxt.shadowBlur = 20;
    ctxt.shadowColor = 'rgba(0, 0, 0, 1)';
    fillPolygons(ctxt, obstacles);
    ctxt.shadowBlur = 0;
    ctxt.shadowColor = '';
  }

  hullSym.singles.forEach(({ poly, tags }) => {
    if (tags.includes('label')) {
      return;
    }
    if (tags.includes('poly')) {
      const matched = (tags[1] || '').match(/^([^-]*)-([^-]*)-([^-]*)$/);
      if (matched) {
        const [, fill, stroke, strokeWidth] = matched;
        setStyle(ctxt, fill || 'transparent', stroke || 'transparent', Number(strokeWidth) || 0);
        fillPolygons(ctxt, [poly]);
        ctxt.stroke();
      } else {
        console.warn('render: saw tag "poly" where other tag had unexpected format');
      }
    }
    if (tags.includes('fuel')) {
      setStyle(ctxt, '#aaa', '#000', 2);
      fillPolygons(ctxt, [poly]), ctxt.stroke();
      setStyle(ctxt, '#aaa', 'rgba(0, 0, 0, 0.5)', 1);
      const center = Vect.average(poly.outline);
      poly.outline.forEach(p => drawLine(ctxt, center, p));
    }
    if (tags.includes('wall')) {// Hull wall singles
      setStyle(ctxt, '#000');
      fillPolygons(ctxt, Poly.cutOut(doorPolys, [poly]));
    }
  });

  //#endregion


  const initTransform = ctxt.getTransform();

  //#region symbol PNGs
  const innerItems = layout.items.slice(1);
  for (const { pngHref, pngRect, transformArray } of innerItems) {
    // ctxt.save();
    const image = await getPng(pngHref);
    transformArray && ctxt.transform(...transformArray);
    ctxt.scale(0.2, 0.2);
    ctxt.drawImage(/** @type {CanvasImageSource} */ (image), pngRect.x, pngRect.y);
    // ctxt.restore();
    ctxt.setTransform(initTransform);
  }
  //#endregion

  //#region overlay

  /**
   * Fill walls
   * - necessary to show our custom walls e.g. near cut doors
   * - do not fill windows
   * - do not fill walls tagged with no-fill
   */
  const wallsToFill = Poly.cutOut(
    singlesToPolys(singles, 'window', ['wall', 'no-fill']),
    walls,
  );
  ctxt.fillStyle = wallColor;
  wallBounds && fillPolygons(ctxt, wallsToFill);

  ctxt.fillStyle = 'rgba(0, 0, 0, 1)';
  fillPolygons(ctxt, layout.hullTop);

  if (doors) {
    drawDoors(ctxt, doorPolys);
  }
  if (thinDoors) {
    drawThinDoors(ctxt, layout);
  }

  if (labels) {
    ctxt.font = labelMeta.font;
    ctxt.textBaseline = 'top';
    for (const { text, rect, padded } of layout.labels) {
      ctxt.fillStyle = 'black';
      ctxt.fillRect(padded.x, padded.y, padded.width, padded.height);
      ctxt.fillStyle = 'white';
      ctxt.fillText(text, rect.x, rect.y)
    }
  }
  //#endregion
}

/** @typedef {HTMLCanvasElement | import('canvas').Canvas} Canvas */
/** @typedef {HTMLImageElement | import('canvas').Image} Image */

/**
 * @param {CanvasRenderingContext2D} ctxt
 * @param {Geom.Poly[]} doorPolys
*/
function drawDoors(ctxt, doorPolys) {
  ctxt.fillStyle = 'rgba(0, 0, 0, 1)';
  fillPolygons(ctxt, doorPolys.flatMap(x => geom.createOutset(x, 1)));
  ctxt.fillStyle = 'rgba(255, 255, 255, 1)';
  fillPolygons(ctxt, doorPolys);
}

/**
 * @param {CanvasRenderingContext2D} ctxt
 * @param {Geomorph.ParsedLayout} layout
*/
export function drawThinDoors(ctxt, layout) {
  // Thin doors avoids overlap (for lighting drawRect)
  ctxt.strokeStyle = 'rgba(0, 0, 0, 1)';
  ctxt.lineWidth = 2;
  layout.doors.forEach(({ seg: [src, dst] }) => {
    ctxt.moveTo(src.x, src.y);
    ctxt.lineTo(dst.x, dst.y);
    ctxt.stroke();
  });
}
