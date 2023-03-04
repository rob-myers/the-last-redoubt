import { Vect } from '../geom/vect';
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
 * Extract numeric part of a CSS variable applied as a style
 * @param {HTMLElement} el 
 * @param {string} varName e.g. `--my-css-var`
 */
export function getNumericCssVar(el, varName) {
	return parseFloat(assertNonNull(el.style.getPropertyValue(varName)));
}

/**
 * 
 * @param {Geom.Circle} circle 
 */
export function circleToCssTransform(circle) {
	return `translate(${circle.center.x}px, ${circle.center.y}px) scale(${2 * circle.radius})`;
}

/**
 * 
 * @param {Geom.VectJson} point 
 */
export function pointToCssTransform(point) {
	return `translate(${point.x}px, ${point.y}px)`;
}

/**
 * @param {Geom.Seg} seg 
 */
export function lineSegToCssTransform(seg) {
	tmpVec.copy(seg.dst).sub(seg.src);
	return `translate(${seg.src.x}px, ${seg.src.y}px) rotate(${tmpVec.degrees}deg) scaleX(${tmpVec.length})`;
}

/**
 * @param {Geom.RectJson} rect 
 * @param {number} [angle] Radians
 */
export function rectToCssTransform(rect, angle = 0) {
	return `translate(${rect.x}px, ${rect.y}px) rotate(${angle.toFixed(2)}rad) scale(${rect.width}, ${rect.height})`;
}

/**
 * @param {HTMLElement} el
 * @returns {Geom.Circle | null}
 */
export function cssTransformToCircle(el) {
	const cacheKey = el.style.getPropertyValue('transform');
	if (cacheKey === '') {
		return null;
	}
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
 * 🚧 Won't predict moving npc vs seg, but other uses?
 * Assume affine transform acts on `(0,0) --> (1, 0)` to produce line segment
 * @param {HTMLElement} el
 * @returns {Geom.Seg | null}
 */
export function cssTransformToLineSeg(el) {
	const cacheKey = el.style.getPropertyValue('transform');
	if (cacheKey === '') {
		return null;
	}
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
 * @returns {Geom.VectJson | null}
 */
export function cssTransformToPoint(el) {
	const cacheKey = el.style.getPropertyValue('transform');
	if (cacheKey === '') {
		return null;
	}
	if (cacheKey in pointCache) {
		return pointCache[cacheKey];
	}
	const matrix = new DOMMatrixReadOnly(window.getComputedStyle(el).transform);
	return pointCache[cacheKey] = { x: matrix.e, y: matrix.f };
}

/**
 * @param {HTMLElement} el
 * @returns {Geom.AngledRect<Geom.RectJson> | null}
 */
export function cssTransformToRect(el) {
	const cacheKey = el.style.getPropertyValue('transform');
	if (cacheKey === '') {// e.g. partially entered invalid value
		return null;
	}
	if (cacheKey in angleRectCache) {
		return angleRectCache[cacheKey];
	}
	const matrix = new DOMMatrixReadOnly(window.getComputedStyle(el).transform);
	return angleRectCache[cacheKey] = {
		angle: Math.atan2(matrix.b, matrix.a),
		baseRect: {
			x: matrix.e,
			y: matrix.f,
			width: (new Vect(matrix.a, matrix.b)).length,
			height: (new Vect(matrix.c, matrix.d)).length,
		},
	};
}

let tmpVec = new Vect;

/** @type {{ [cssTransformValue: string]: Geom.Circle }} */
const circleCache = {};
/** @type {{ [cssTransformValue: string]: Geom.Seg }} */
const lineSegCache = {};
/** @type {{ [cssTransformValue: string]: Geom.VectJson }} */
const pointCache = {};
/** @type {{ [cssTransformValue: string]: Geom.AngledRect<Geom.RectJson> }} */
const angleRectCache = {};

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
 * @param {Geom.Poly[]} polys
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
 * @param {Geom.Poly[]} polys
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
 * @param {Geom.Vect} from
 * @param {Geom.Vect} to
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

/**
 * TODO properly?
 * @param {MouseEvent | WheelEvent} e
 */
export function getRelativePos(e) {
	const { left, top } = (/** @type {HTMLElement} */ (e.currentTarget)).getBoundingClientRect();
	return new Vect(e.clientX - left, e.clientY - top);
}

/**
 * Fixes proxies displayed in React DevTool
 * @param {string} key
 * @returns {key is '$$typeof' | 'constructor'}
 */
export function detectReactDevToolQuery(key) {
	return key === '$$typeof' || key === 'constructor' || typeof key === 'symbol';
}

/**
 * @param {Animation} anim 
 * @param {HTMLElement} el 
 * @param {Animation['playState'][]} [playStates] optionally require playState ∊ playStates
 */
export function isAnimAttached(anim, el, playStates) {
	return (
		el.getAnimations().includes(anim)
		&& (!playStates || playStates.includes(anim.playState))
	);
}

/**
 * @param {Animation} anim 
 */
export function isPaused(anim) {
	return anim.playState === 'paused';
}

/**
 * @param {Animation} anim 
 */
export function isRunning(anim) {
	return anim.playState === 'running';
}

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
 * https://github.com/ihordiachenko/supports-webp-sync/blob/master/index.ts
 * @returns {boolean}
 */
function checkWebPSupport()  {
	if (typeof window === "undefined") { // SSE sanity check
			return false
	}

	// Use canvas hack for webkit-based browsers
	// Kudos to Rui Marques: https://stackoverflow.com/a/27232658/7897049
	const e = document.createElement('canvas')
	e.width = 1
	e.height = 1
	if (e.toDataURL && e.toDataURL('image/webp').indexOf('data:image/webp') == 0) {
			return true
	}

	// 
	/**
	 * Check other common browsers by version
	 */
	let m = navigator.userAgent.match(/(Edg|Firefox)\/(\d+)\./)
	if (m) {
			return (m[1] === 'Firefox' && Number(m[2]) >= 65) || (m[1] === 'Edge' && Number(m[2]) >= 18)
	}

	m = navigator.userAgent.match(/OS X\s?(?<os>\d+)?.+ Version\/(?<v>\d+\.\d+)/)
	if (m) {
			// Intl.ListFormat only works on Safari 14.1+ & MacOS 11+ - nearly the same specifications as WebP support.
			// See https://caniuse.com/webp & https://caniuse.com/?search=Intl.ListFormat
			const intl = window.Intl || {}
			const groups = /** @type {Record<string, string>} */ (m.groups);
			return Number(groups.v) >= 14 && ((Number(groups.os) || 99) >= 11 || /** @type {*} */ (intl).ListFormat != null)
	}

	return false
}

/**
 * https://github.com/ihordiachenko/supports-webp-sync/blob/master/index.ts
 */
export const supportsWebp = checkWebPSupport();

//#endregion