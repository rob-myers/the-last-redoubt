import { assertNonNull, precision } from './generic';
import { Vect, Mat } from '../geom';

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
 * 🚧 nested div whenever scale/rotate?
 */

/**
 * @param {Geom.Circle} circle 
 */
export function circleToCssStyles(circle) {
	return {
		left: precision(circle.center.x - circle.radius),
		top: precision(circle.center.y - circle.radius),
		width: precision(2 * circle.radius),
	};
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
 * @param {number} angle Radians
 * @returns {import('react').CSSProperties}
 */
export function rectToCssStyles(rect, angle) {
	return {
		left: precision(rect.x),
		top: precision(rect.y),
		width: precision(rect.width),
		height: precision(rect.height),
		transform: `rotate(${precision(angle * (180 / Math.PI))}deg)`,
	};
}

/**
 * @param {HTMLElement} el
 * @returns {Geom.Circle | null}
 */
export function cssStylesToCircle(el) {
	const top = parseFloat(el.style.getPropertyValue('top'));
	const left = parseFloat(el.style.getPropertyValue('left'));
	/** By taking average, changing either width/height causes React to render DOM */
	const radius = precision((
		parseFloat(el.style.getPropertyValue('width')) +
		parseFloat(el.style.getPropertyValue('height'))
	) / 4);
	const [cx, cy] = [precision(left + radius), precision(top + radius)];
	if (![cx, cy, radius].every(x => Number.isFinite(x))) {
		return null; // Reachable?
	} else {
		return { radius, center: { x: cx, y: cy } };
	};
}

/**
 * @param {HTMLElement} el
 * @returns {Geom.Vect | null}
 */
export function cssStylesToPoint(el) {
	const top = parseFloat(el.style.getPropertyValue('top'));
	const left = parseFloat(el.style.getPropertyValue('left'));
	if (![top, left].every(x => Number.isFinite(x))) {
		return null;
	} else {
		return new Vect(left, top);
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
		src: { x: precision(matrix.e), y: precision(matrix.f) },
		// 1st column of 2x2 matrix (a b), offset by (e, f)
		dst: { x: precision(matrix.a) + precision(matrix.e), y: precision(matrix.b) + precision(matrix.f) },
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
	return pointCache[cacheKey] = { x: precision(matrix.e), y: precision(matrix.f) };
}

/**
 * @param {HTMLElement} el
 * @returns {Geom.AngledRect<Geom.RectJson> | null}
 */
export function cssStylesToRect(el) {
	const left = parseFloat(el.style.getPropertyValue('left'));
	const top = parseFloat(el.style.getPropertyValue('top'));
	const width = parseFloat(el.style.getPropertyValue('width'));
	const height = parseFloat(el.style.getPropertyValue('height'));
	const rotMatrix = new DOMMatrix((el.style.getPropertyValue('transform')));
	const angleRadians = Math.atan2(rotMatrix.b, rotMatrix.a);
	if (![left, top, width, height, angleRadians].every(x => Number.isFinite(x))) {// e.g. partially entered invalid value
		return null;
	} else {
		return {
			angle: angleRadians,
			baseRect: {
				x: precision(left),
				y: precision(top),
				width: precision(width),
				height: precision(height),
			},
		};
	}
}

let tmpVec = new Vect;

/** @type {{ [cssTransformValue: string]: Geom.Seg }} */
const lineSegCache = {};
/** @type {{ [cssTransformValue: string]: Geom.VectJson }} */
const pointCache = {};

/**
 * Parse input with string fallback
 * - preserves `undefined`
 * - preserves empty-string
 * @param {string} [input]
 */
export function parseJsArg(input) {
	try {
	  if (input === '') return input;
	  return Function(`return ${input}`)();
	} catch (e) {
	  return input;
	}
}

/**
 * JSON.parse with string fallback
 * @param {string} input
 */
export function parseJsonArg(input) {
	try {
		return input === undefined ? undefined : JSON.parse(input);
	} catch {
		return input;
	}
}

//#endregion

//#region canvas

/**
 * @param {HTMLImageElement | (import('canvas').Image & CanvasImageSource)} image 
 * @param {CanvasRenderingContext2D} tempCtxt
 * @param {CanvasRenderingContext2D} dstCtxt
 * @param {string} [fillColor]
 */
export function invertDrawnImage(image, tempCtxt, dstCtxt, fillColor = '#ffffff') {
	createMonochromeMask(image, tempCtxt, fillColor);
	// Take difference to obtain inverted image
    dstCtxt.globalCompositeOperation = 'difference';
    dstCtxt.drawImage(/** @type {CanvasImageSource} */ (tempCtxt.canvas), 0, 0);
    dstCtxt.globalCompositeOperation = 'source-over';
}

/**
 * @param {HTMLImageElement | (import('canvas').Image & CanvasImageSource)} image 
 * @param {CanvasRenderingContext2D} tempCtxt
 * @param {CanvasRenderingContext2D} dstCtxt
 * @param {string} fillColor e.g. `#00000077`
 */
export function darkenDrawnImage(image, tempCtxt, dstCtxt, fillColor) {
	createMonochromeMask(image, tempCtxt, fillColor);
    dstCtxt.globalCompositeOperation = 'source-over';
    dstCtxt.drawImage(/** @type {CanvasImageSource} */ (tempCtxt.canvas), 0, 0);
}

/**
 * Mutates ctxt.transform.
 * @param {HTMLImageElement | (import('canvas').Image & CanvasImageSource)} image 
 * @param {CanvasRenderingContext2D} ctxt 
 * @param {Geom.RectJson} rect 
 * @param {number} radians 
 */
export function drawRotatedImage(image, ctxt, rect, radians) {
	tempMat.setRotationAbout(radians, { x: rect.x + rect.width/2, y: rect.y + rect.height/2 });
	ctxt.transform(tempMat.a, tempMat.b, tempMat.c, tempMat.d, tempMat.e, tempMat.f);
	ctxt.drawImage(image, rect.x, rect.y, rect.width, rect.height);
}

/**
 * @param {HTMLImageElement | (import('canvas').Image & CanvasImageSource)} image 
 * @param {CanvasRenderingContext2D} tempCtxt
 * @param {CanvasRenderingContext2D} dstCtxt
 * @param {string} [fillColor]
 */
export function lightenDrawnImage(image, tempCtxt, dstCtxt, fillColor = '#ffffff') {
	createMonochromeMask(image, tempCtxt, fillColor);
    dstCtxt.globalCompositeOperation = 'lighter';
    dstCtxt.drawImage(/** @type {CanvasImageSource} */ (tempCtxt.canvas), 0, 0);
}

/**
 * Draw opaque part of `image` in colour `fillColour`
 * @param {HTMLImageElement | (import('canvas').Image & CanvasImageSource)} image 
 * @param {CanvasRenderingContext2D} ctxt
 * @param {string} fillColor
 */
function createMonochromeMask(image, ctxt, fillColor) {
	ctxt.canvas.width = image.width;
	ctxt.canvas.height = image.height;
	ctxt.globalCompositeOperation = 'source-over';
	ctxt.drawImage(/** @type {*} */ (image), 0, 0);
	ctxt.globalCompositeOperation = 'source-in';
	ctxt.fillStyle = fillColor;
	ctxt.fillRect(0, 0, image.width, image.height);
	ctxt.globalCompositeOperation = 'source-over';
}

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
 * @param {boolean} [stroke]
 */
export function fillPolygons(ctxt, polys, stroke = false) {
	for (const poly of polys) {
		ctxt.beginPath();
		fillRing(ctxt, poly.outline, false);
		for (const hole of poly.holes) {
			fillRing(ctxt, hole, false);
		}
		ctxt.fill();
		stroke && ctxt.stroke();
	}
}

/**
 * @param {CanvasRenderingContext2D} ctxt
 * @param {Geom.Poly[]} polys
 */
export function strokePolygons(ctxt, polys) {
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
 * @param {Geom.VectJson} center
 * @param {number} radius
 */
export function drawCircle(ctxt, center, radius) {
	ctxt.beginPath();
	ctxt.ellipse(center.x, center.y, radius, radius, 0, 0, 2 * Math.PI)
	ctxt.stroke();
}

/**
 * @param {CanvasRenderingContext2D} ctxt
 * @param {Geom.VectJson} from
 * @param {Geom.VectJson} to
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
 */
export function isAnimAttached(anim, el) {
	return el.getAnimations().includes(anim);
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

export function isSmallViewport() {
	return (
		typeof window !== 'undefined' &&
		window.matchMedia(`(max-width: ${'400'}px)`).matches
	);
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
 * Navigate `toHash` with ensured previous state `fromHash`.
 * @param {string} fromHash e.g. #foo
 * @param {string} toHref e.g. bar/baz#qux
 */
export function navigateFromHash(fromHash, toHref) {
    if (location.hash !== fromHash) {
        history.pushState({}, '', `${location.origin}${location.pathname}${fromHash}`);
    }
    location.href = toHref;
}

//#endregion

//#region webp

/** @type {HTMLCanvasElement} */
let tempCanvas;

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
	const e = (tempCanvas ??= document.createElement('canvas'))
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

const tempMat = new Mat;
