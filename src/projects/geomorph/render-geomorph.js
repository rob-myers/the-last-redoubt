import { createCanvas } from "canvas";
import { Poly, Vect, Rect } from "../geom";
import { debugArrowAlpha, debugDoorOffset, debugArrowRadius, gmScale, preDarkenCssRgba, gridDimWorld } from "../world/const";
import { labelMeta, singlesToPolys, drawTriangulation } from '../service/geomorph';
import { computeCliques } from "../service/generic";
import { invertDrawnImage, drawLine, fillPolygons, fillRing, setStyle, drawRotatedImage } from '../service/dom';
import { error, warn } from "../service/log";

/**
 * Render a single geomorph PNG,
 * optionally with e.g. doors.
 * @param {Geomorph.ParsedLayout} layout
 * @param {Geomorph.SymbolLookup} lookup
 * @param {Canvas} canvas
 * @param {(pngHref: string) => Promise<HTMLImageElement | (import('canvas').Image & CanvasImageSource)>} getPng
 * - `pngHref` has local url format `/assets/symbol/foo`
 * @param {Geomorph.RenderOpts} opts
 */
export async function renderGeomorph(
  layout,
  lookup,
  canvas,
  getPng,
  {
    scale = gmScale,
    obsBounds = true,
    wallBounds = true,
    highlights = true,
    navTris = false,
    navOutline = navTris,
    doors = false,
    thinDoors = false,
    hullDoorBases = false,
    labels = false,
    arrows = false,
    floorColor = 'rgba(180, 180, 180, 1)',
    navColor = 'rgba(200, 200, 200, 1)',
    navStroke = 'rgba(0, 0, 0, 0.25)',
    obsColor = 'rgba(100, 100, 100, 0.45)',
    wallColor = 'rgba(50, 40, 40, 1)',
    invertSymbols = false,
    darken = false,
  },
) {
  const hullSym = lookup[layout.items[0].key];
  const hullPoly = hullSym.hull[0];
  const pngRect = hullSym.pngRect;

  canvas.width = pngRect.width * scale;
  canvas.height = pngRect.height * scale;

  const ctxt = /** @type {CanvasRenderingContext2D | NodeCanvasContext} */ (canvas.getContext('2d'));
  ctxt.setTransform(scale, 0, 0, scale, -scale * pngRect.x, -scale * pngRect.y);
  const initTransform = ctxt.getTransform();
  ctxt.imageSmoothingEnabled = true;
  ctxt.imageSmoothingQuality = 'high';
  ctxt.lineJoin = 'round';

  //#region underlay

  // Floor
  ctxt.fillStyle = floorColor;
  if (hullSym.hull.length === 1 && hullPoly.holes.length) {
    fillRing(ctxt, hullPoly.outline);
  } else {
    error('hull walls must exist, be connected, and have a hole');
  }

  // Floor polygons from non-hull symbols
  // e.g. `poly floor fillColor=#00000044`
  ctxt.save();
  for (const { key, transformArray } of layout.items.slice(1)) {
    ctxt.transform(...transformArray ?? [1, 0, 0, 1, 0, 0]);
    ctxt.scale(0.2, 0.2);
    drawSymbolPolys(key, ctxt, lookup, true);
    ctxt.setTransform(initTransform);
  }
  ctxt.restore();

  if (navOutline) {
    ctxt.fillStyle = navColor;
    ctxt.strokeStyle = navStroke;
    fillPolygons(ctxt, layout.navPoly, true);
  }

  if (navTris) {
    ctxt.strokeStyle = navStroke;
    ctxt.lineWidth = 0.2;
    drawTriangulation(ctxt, layout.navZone)
  }

  const { singles, obstacles, walls } = layout.groups;
  const doorPolys = singlesToPolys(singles, 'door');

  ctxt.lineJoin = 'round';
  
  // Light grey under obstacles, possibly with drop shadow
  if (obsBounds) {
    ctxt.fillStyle = obsColor;
    if (highlights) {
      ctxt.shadowBlur = 10;
      ctxt.shadowColor = 'rgba(0, 0, 0, 1)';
    }
    fillPolygons(ctxt, obstacles.map(({ poly }) => poly));
    ctxt.shadowBlur = 0;
    ctxt.shadowColor = '';
  }

  // Floor highlights via radial fills
  if (highlights) {
    const floorHighlights = layout.floorHighlightIds.map(index => layout.groups.singles[index]);
    const hullOutlinePoly = new Poly(hullPoly.outline);
    ctxt.globalCompositeOperation = 'lighter';
    floorHighlights.forEach(({ poly }, i) => {
      const { center: position, rect } = poly;
      const distance = Math.min(rect.width, rect.height) / 2;
      const gradient = ctxt.createRadialGradient(position.x, position.y, 1, position.x, position.y, distance);
      gradient.addColorStop(0, '#bbbbbb55');
      gradient.addColorStop(0.4, '#bbbbbb33');
      gradient.addColorStop(1, "#00000000");
      ctxt.fillStyle = gradient;
      // Must restrict to hull poly outline
      fillPolygons(ctxt, Poly.intersect([hullOutlinePoly], [poly]));
      // fillPolygons(ctxt, [poly]);
    });
    ctxt.globalCompositeOperation = 'source-over';
  }

  // Hull wall singles
  hullSym.singles.forEach(({ poly, meta }) => {
    if (meta.wall) {
      setStyle(ctxt, '#000000');
      fillPolygons(ctxt, Poly.cutOut(doorPolys, [poly]));
    }
  });
  // Hull polygons drawn above hull walls
  hullSym.singles.forEach(({ poly, meta }) => {// Always above wall
    if (meta.poly) {
      const [fillColor, strokeColor, strokeWidth] = [
        typeof meta.fillColor === 'string' ? meta.fillColor : 'transparent',
        typeof meta.strokeColor === 'string' ? meta.strokeColor : 'transparent',
        typeof meta.strokeWidth === 'number' ? meta.strokeWidth : 0,
      ];
      setStyle(ctxt, fillColor, strokeColor, strokeWidth);
      fillPolygons(ctxt, [poly]);
      ctxt.stroke();
    }
  });
  // 🚧 Replace with decal
  hullSym.singles.forEach(({ poly, meta }) => {
    if (meta.fuel) {
      setStyle(ctxt, '#aaa', '#000', 2);
      fillPolygons(ctxt, [poly]), ctxt.stroke();
      setStyle(ctxt, '#aaa', 'rgba(0, 0, 0, 0.5)', 1);
      const center = Vect.average(poly.outline);
      poly.outline.forEach(p => drawLine(ctxt, center, p));
    }
  });

  //#endregion


  //#region symbol PNGs
  for (const { key, pngHref, pngRect, transformArray, invert, svgPngScale } of layout.items.slice(1)) {    
    // Draw symbol png
    const image = await getPng(pngHref);
    ctxt.transform(...transformArray ?? [1, 0, 0 ,1, 0, 0]);
    
    ctxt.scale(0.2, 0.2);
    ctxt.scale(1 / svgPngScale, 1 / svgPngScale);

    ctxt.globalCompositeOperation = 'source-over';
    ctxt.drawImage(image, pngRect.x, pngRect.y);

    /**
     * Can invert symbols by default, except `extra--*`.
     * Can toggle inversion of individual symbols.
     */
    if (key.startsWith('extra--')
      ? !!invert
      : invertSymbols !== !!invert
    ) {
      ctxt.translate(pngRect.x, pngRect.y);
      invertDrawnImage(image, tempCtxt, ctxt, '#ffffff');
    }

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
  fillPolygons(ctxt, singlesToPolys(singles, ['wall', 'dark']));

  if (doors) {
    drawDoors(ctxt, layout);
  }
  if (thinDoors) {
    drawThinDoors(ctxt, layout);
  }
  if (hullDoorBases) {
    ctxt.fillStyle = 'rgba(200, 200, 200, 1)';
    ctxt.strokeStyle = navStroke;
    ctxt.lineWidth = 1;
    drawHullDoorBases(ctxt, layout);
  }

  if (labels) {
    ctxt.font = labelMeta.font;
    ctxt.textBaseline = 'top';
    ctxt.fillStyle = 'black';
    for (const { text, rect } of layout.labels) {
      ctxt.fillText(text, rect.x, rect.y)
    }
  }
  //#endregion

  if (darken) {// Darken the geomorph (for lighting)
    const hullPolySansHoles = layout.hullPoly.map(x => x.clone().removeHoles());
    ctxt.fillStyle = preDarkenCssRgba;
    fillPolygons(ctxt, hullPolySansHoles);
  }

  if (arrows) {
    const iconCircleRight = await getPng('/assets/icon/circle-right.svg');
    const saved = ctxt.getTransform();
    ctxt.globalAlpha = debugArrowAlpha;
    layout.doors.forEach(({ poly, normal, roomIds }) => {
      roomIds.forEach((_, i) => {
        const sign = i === 0 ? 1 : -1;
        const { angle } = Vect.from(normal).scale(-sign);
        const arrowPos = poly.center.addScaledVector(normal, sign * debugDoorOffset).translate(-debugArrowRadius, -debugArrowRadius);
        drawRotatedImage(iconCircleRight, ctxt, { ...arrowPos, width: debugArrowRadius * 2, height: debugArrowRadius * 2 }, angle);
        ctxt.setTransform(saved);
      });
    });
    ctxt.globalAlpha = 1;
  }
}

/** @typedef {HTMLCanvasElement | import('canvas').Canvas} Canvas */
/** @typedef {HTMLImageElement | import('canvas').Image} Image */
/** @typedef {ReturnType<import('canvas').Canvas['getContext']>} NodeCanvasContext */

/**
 * @param {CanvasRenderingContext2D} ctxt
 * @param {Geomorph.ParsedLayout} layout
*/
function drawDoors(ctxt, layout) {
  ctxt.strokeStyle = 'rgba(0, 0, 0, 1)';
  ctxt.fillStyle = 'rgba(255, 255, 255, 1)';
  ctxt.lineWidth = 1;

  // cover nearby hull doors with a single rect
  const hullDoors = layout.doors.filter(x => x.meta.hull);
  const rect = new Rect;
  const cliques = computeCliques(hullDoors, (x, y) => rect.copy(x.rect).outset(30).intersects(y.rect));
  cliques.forEach(clique => // take union of rects
    fillPolygons(ctxt, [Poly.fromRect(Rect.fromRects(...clique.map(x => x.rect)))], true)
  );

  const otherPolys = layout.doors.flatMap(x => !x.meta.hull ? [x.poly] : []);
  fillPolygons(ctxt, otherPolys, true);
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

/**
 * @param {CanvasRenderingContext2D} ctxt
 * @param {Geomorph.ParsedLayout} layout
*/
export function drawHullDoorBases(ctxt, layout) {
  layout.doors.forEach(({ meta, normal, rect }) => {
    if (meta.hull) {
      const tangent = normal.clone().rotate(Math.PI/2);
      const left = rect.center.addScaledVector(tangent, 8);
      const right = rect.center.addScaledVector(tangent, -8);
      const halfHeight = 6;
      const basePoly = new Poly([
        left.clone().addScaledVector(normal, -halfHeight),
        right.clone().addScaledVector(normal, -halfHeight),
        right.clone().addScaledVector(normal, halfHeight),
        left.clone().addScaledVector(normal, halfHeight),
      ]);
      fillPolygons(ctxt, [basePoly]);

      drawLine(ctxt, basePoly.outline[0], basePoly.outline[3]);
      drawLine(ctxt, basePoly.outline[1], basePoly.outline[2]);
    }
  });
}

/**
 * @param {Geomorph.SymbolKey} key
 * @param {CanvasRenderingContext2D} ctxt
 * @param {Geomorph.SymbolLookup} lookup
 * @param {boolean} [floor] 
 */
function drawSymbolPolys(key, ctxt, lookup, floor = false) {
  const polySingles = lookup[key].singles.filter(x => x.meta.poly && (!!floor === !!x.meta.floor));
  polySingles.forEach(({ meta, poly }) => {
    const [fillColor, strokeColor, strokeWidth] = [
      typeof meta.fillColor === 'string' ? meta.fillColor : 'transparent',
      typeof meta.strokeColor === 'string' ? meta.strokeColor : 'transparent',
      typeof meta.strokeWidth === 'number' ? meta.strokeWidth : 0,
    ];
    setStyle(ctxt, fillColor, strokeColor, strokeWidth);
    fillPolygons(ctxt, [poly]);
  });
}

/** For inverting PNG symbols */
const tempCtxt = createCanvas(0, 0).getContext('2d');
