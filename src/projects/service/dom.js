import { parseSVG, makeAbsolute } from 'svg-path-parser';
import { Vect } from '../geom/vect';
import { Poly } from '../geom/poly';
import { warn } from './log';
import { assertNonNull } from './generic';

//#region svg event

/** @param {WheelEvent | PointerEvent | React.WheelEvent} e */
export function isSvgEvent(e) {
	return e.target && 'ownerSVGElement' in e.target;
}

/**
 * @typedef SvgPtr @type {object}
 * @property {null | number} pointerId
 * @property {number} clientX
 * @property {number} clientY
 * @property {SVGSVGElement} ownerSvg
 */

/**
 * Get SVG world position i.e. userspace.
 * @param {SvgPtr} ptr 
 * @param {SVGGraphicsElement} [targetEl] 
 */
 export function getSvgPos(ptr, targetEl) {
  svgPoint = svgPoint || ptr.ownerSvg.createSVGPoint();
  svgPoint.x = ptr.clientX;
  svgPoint.y = ptr.clientY;
  return svgPoint.matrixTransform((targetEl || ptr.ownerSvg).getScreenCTM()?.inverse());
}

/**
 * The pointer `ptrs[0]` must exist.
 * @param {SvgPtr[]} ptrs
 */
export function getSvgMid(ptrs) {
  svgPoint = svgPoint || ptrs[0].ownerSvg.createSVGPoint();
	svgPoint.x = svgPoint.y = 0;
	ptrs.forEach(e => { svgPoint.x += e.clientX; svgPoint.y += e.clientY; });
	svgPoint.x /= ptrs.length || 1; svgPoint.y /= ptrs.length || 1;
  return svgPoint.matrixTransform(ptrs[0].ownerSvg.getScreenCTM()?.inverse());
}

/**
 * Assumes `e.currentTarget` is an SVGElement or SVGSVGElement.
 * @param {MouseEvent | import('react').MouseEvent} e
 * @returns {SvgPtr}
 */
export function projectSvgEvt(e) {
	return {
		pointerId: e instanceof PointerEvent ? e.pointerId : null,
		clientX: e.clientX,
		clientY: e.clientY,
		ownerSvg: /** @type {*} */ (e.currentTarget)?.ownerSVGElement || e.currentTarget,
	};
}

/** @type {DOMPoint} */
let svgPoint;

//#endregion

//#region parse

/**
 * Extract numeric part of a css variable
 * @param {HTMLElement} el 
 * @param {string} varName e.g. `--my-css-var`
 */
export function getNumericCssVar(el, varName) {
	return parseFloat(assertNonNull(el.style.getPropertyValue(varName)));
}

/**
 * Based on https://github.com/Phrogz/svg-path-to-polygons/blob/master/svg-path-to-polygons.js.
 * - Only supports straight lines i.e. M, L, H, V, Z.
 * - Expects a __single polygon__ with ≥ 0 holes.
 * @param {string} svgPathString
 * @returns {null | Geom.Poly}
 */
export function svgPathToPolygon(svgPathString) {
	const rings = /** @type {Vect[][]} */ ([]);
	let ring = /** @type {Vect[]} */ ([]);

	/**
	 * @param {number} x 
	 * @param {number} y 
	 */
  function add(x, y){
    ring.push(new Vect(x, y));
  }

	makeAbsolute(parseSVG(svgPathString)).forEach(cmd => {
		switch(cmd.code) {
			case 'M':
				rings.push(ring = []);
			// eslint-disable-next-line no-fallthrough
			case 'L':
			case 'H':
			case 'V':
			case 'Z':
				add(/** @type {import('svg-path-parser').MoveToCommand} */ (cmd).x || 0, /** @type {import('svg-path-parser').MoveToCommand} */ (cmd).y || 0);
			break;
			default:
				throw Error(`svg command ${cmd.command} is not supported`);
		}
	});

	const polys = rings.map(ps => new Poly(ps));
	
	if (polys.length === 0) {
		return null;
	} else if (polys.length === 1) {
		return polys[0];
	}

	// Largest polygon 1st
	polys.sort((a, b) => a.rect.area < b.rect.area ? 1 : -1);
	return new Poly(
		polys[0].outline,
		polys.slice(1).map(poly => poly.outline),
	);
}

/**
 * 
 * @param {Geom.Circle} circle 
 */
export function circleToCssTransform(circle) {
	return `translate(${circle.center.x}px, ${circle.center.y}px) scale(${2 * circle.radius})`;
}

/**
 * @param {Geom.Seg} seg 
 */
export function lineSegToCssTransform(seg) {
	tmpVec.copy(seg.dst).sub(seg.src);
	return `translate(${seg.src.x}px, ${seg.src.y}px) rotate(${tmpVec.degrees}deg) scaleX(${tmpVec.length})`;
}

/**
 * @param {HTMLElement} el
 * @returns {Geom.Circle}
 */
export function cssTransformToCircle(el) {
	const cacheKey = el.style.getPropertyValue('transform');
	if (cacheKey in circleCache) {
		return circleCache[cacheKey];
	}
	const matrix = new DOMMatrixReadOnly(window.getComputedStyle(el).transform);
	return circleCache[cacheKey] = {
		radius: matrix.a / 2, // expect 2*2 matrix cols (2 * radius, 0) (0, 2 * radius)
		center: { x: matrix.e, y: matrix.f },
	};
}

/**
 * Assume affine transform acts on `(0,0) --> (1, 0)` to produce line segment
 * @param {HTMLElement} el
 * @returns {Geom.Seg}
 */
export function cssTransformToLineSeg(el) {
	const cacheKey = el.style.getPropertyValue('transform');
	if (cacheKey in lineSegCache) {
		return lineSegCache[cacheKey];
	}
	const matrix = new DOMMatrixReadOnly(window.getComputedStyle(el).transform);
	return lineSegCache[cacheKey] = {
		// Zero vector offset by (e, f)
		src: { x: matrix.e, y: matrix.f },
		// 1st column of 2x2 matrix (a b), offset by (e, f)
		dst: { x: matrix.a + matrix.e, y: matrix.b + matrix.f },
	};
}

/**
 * @param {HTMLElement} el
 * @returns {Geom.VectJson}
 */
export function cssTransformToPoint(el) {
	const cacheKey = el.style.getPropertyValue('transform');
	if (cacheKey in pointCache) {
		return pointCache[cacheKey];
	}
	const matrix = new DOMMatrixReadOnly(window.getComputedStyle(el).transform);
	return pointCache[cacheKey] = { x: matrix.e, y: matrix.f };
}

let tmpVec = new Vect;

/** @type {{ [cssTransformValue: string]: Geom.Circle }} */
const circleCache = {};

/** @type {{ [cssTransformValue: string]: Geom.Seg }} */
const lineSegCache = {};

/** @type {{ [cssTransformValue: string]: Geom.VectJson }} */
const pointCache = {};


//#endregion

//#region canvas

/**
 * @param {CanvasRenderingContext2D} ctxt 
 * @param  {Geom.VectJson[]} ring 
 */
export function fillRing(ctxt, ring, fill = true) {
  if (ring.length) {
    ctxt.moveTo(ring[0].x, ring[0].y);
    ring.forEach(p => ctxt.lineTo(p.x, p.y));
    fill && ctxt.fill();
    ctxt.closePath();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctxt
 * @param {Poly[]} polys
 */
export function fillPolygon(ctxt, polys) {
	for (const poly of polys) {
		ctxt.beginPath();
    fillRing(ctxt, poly.outline, false);
    for (const hole of poly.holes) {
      fillRing(ctxt, hole, false);
    }
    ctxt.fill();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctxt
 * @param {Poly[]} polys
 */
export function strokePolygon(ctxt, polys) {
	for (const poly of polys) {
		ctxt.beginPath();
    fillRing(ctxt, poly.outline, false);
    for (const hole of poly.holes) {
      fillRing(ctxt, hole, false);
    }
    ctxt.stroke();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctxt
 * @param {Vect} from
 * @param {Vect} to
 */
export function drawLine(ctxt, from, to) {
	ctxt.beginPath();
	ctxt.moveTo(from.x, from.y);
	ctxt.lineTo(to.x, to.y);
	ctxt.stroke();
}

/**
 * @param {CanvasRenderingContext2D} ctxt
 * @param {string} fillStyle
 * @param {string} [strokeStyle]
 * @param {number} [lineWidth]
 */
export function setStyle(ctxt, fillStyle, strokeStyle, lineWidth) {
	ctxt.fillStyle = fillStyle;
	strokeStyle && (ctxt.strokeStyle = strokeStyle);
	lineWidth !== undefined && (ctxt.lineWidth = lineWidth);
}

//#endregion

//#region unsorted

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
	return new Promise((resolve, _reject)=> {
		const img = new Image;
		img.onload = () => resolve(img);
		img.src = src;
	});
}

/**
 * _TODO_ properly.
 * @param {MouseEvent | WheelEvent} e
 */
export function getRelativePos(e) {
	const { left, top } = (/** @type {HTMLElement} */ (e.currentTarget)).getBoundingClientRect();
	return new Vect(e.clientX - left, e.clientY - top);
}

/**
 * https://stackoverflow.com/a/4819886/2917822
 * If Chrome devtool initially open as mobile device,
 * `'ontouchstart' in window` continues to be true if switch to desktop.
 */
export function canTouchDevice() {
  return (
    typeof window !== 'undefined' && (
    'ontouchstart' in window
    || navigator.maxTouchPoints > 0
    || /** @type {*} */ (navigator).msMaxTouchPoints > 0
  ));
}

//#endregion