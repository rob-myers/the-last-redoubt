import { Element } from 'cheerio';
import { Poly, Rect, Mat, Vect } from '../geom';
import { geom } from './geom';
import { warn } from './log';

/**
 * - Test if node has child <title>{title}</title>,
 * - Additionally add class {title} if so.
 * @param {import('cheerio').CheerioAPI} api 
 * @param {Element} node 
 * @param {string} title 
 */
export function hasTitle(api, node, title) {
  return api(node).children('title').text() === title && api(node).addClass(title)
}

/**
 * Test if node has child <title>{nodeTitle}</title> matching regex
 * @param {import('cheerio').CheerioAPI} api 
 * @param {Element} node 
 * @param {RegExp} regex 
 */
export function matchesTitle(api, node, regex) {
  return regex.test(api(node).children('title').text());
}

/**
 * @param {import('cheerio').CheerioAPI} api
 * @param {Element[]} topNodes
 * @param {string} title
 * @param {number} [precisionDp]
 */
export function extractGeomsAt(api, topNodes, title, precisionDp) {
  const group = topNodes.find(x => hasTitle(api, x, title));
  return group ? extractGeoms(api, group, precisionDp) : [];
}

/**
 * @param {import('cheerio').CheerioAPI} api
 * @param {Element} parent
 * @param {number} [precisionDp]
 */
export function extractGeoms(api, parent, precisionDp = 4) {
  const children = api(parent).children('rect, path, ellipse').toArray();
  return children.flatMap(x => extractGeom(api, x)).map(x => x.precision(precisionDp));
}

/**
 * @param {import('cheerio').CheerioAPI} api
 * @param {Element} el
 */
export function extractGeom(api, el) {
  const { tagName, attribs: a } = el;
  const output = /** @type {(Geom.Poly & { _ownTags: string[] })[]} */ ([]);
  const title = api(el).children('title').text() || null;
  const _ownTags = title ? title.split(' ') : [];

  if (tagName === 'rect') {
    const poly = Poly.fromRect(new Rect(Number(a.x ?? 0), Number(a.y ?? 0), Number(a.width ?? 0), Number(a.height ?? 0)))
    output.push(Object.assign(poly, { _ownTags }));
  } else if (tagName === 'path') {
    // Must be a single connected polygon with ≥ 0 holes
    const poly = geom.svgPathToPolygon(a.d);
    poly && output.push(Object.assign(poly, { _ownTags }));
  } else if (tagName === 'ellipse') {
    // Reinterpret ellipse as bounding rectangle (technically preserves info)
    const poly = Poly.fromRect(new Rect((Number(a.cx) - Number(a.rx)) || 0, (Number(a.cy) - Number(a.ry)) || 0, 2 * Number(a.rx) || 0, 2 * Number(a.ry) || 0))
    // Store extra tags for easy extraction
    // _ownTags.push(`ellipse-${a.cx}-${a.cy}-${a.rx}-${a.ry}`, a.transform);
    output.push(Object.assign(poly, { _ownTags }));
  } else {
    console.warn('extractGeom: unexpected tagName:', tagName, a);
  }

  // DOMMatrix not available server-side
  const { transformOrigin, transformBox } = extractTransformData(el);
  if (a.transform && transformOrigin) {
    const m = new Mat(a.transform);
    if (transformBox === 'fill-box') {
      transformOrigin.x += Number(el.attribs.x ?? '0');
      transformOrigin.y += Number(el.attribs.y ?? '0');
    }
    return output.map(poly =>
      poly.translate(-transformOrigin.x, -transformOrigin.y).applyMatrix(m).translate(transformOrigin.x, transformOrigin.y)
    );
  } else if (a.transform) {
    const m = new Mat(a.transform);
    return output.map(poly => poly.applyMatrix(m));
  } else {
    return output;
  }
}

/**
 * @param {string} styleAttrValue 
 */
function extractStyles(styleAttrValue) {
  return styleAttrValue.split(';')
    .reduce((agg, x) => {
      const [k, v] = /** @type {[string, string]} */ (x.split(':').map(x => x.trim()));
      agg[k] = v;
      return agg;
    }, /** @type {Record<string, string>} */ ({})
  );
}

/**
 * Assume `el` has attributes `width` and `height` for percentages.
 * In SVG initial CSS value is `0 0` (elsewhere `50% 50% 0`)
 * @param {Element} el
 * @param {Record<string, string>} [style] previously parsed styles
 * @returns {{ transformOrigin: Geom.Vect | null; transformBox: string | null; }}
 */
function extractTransformData(el, style) {
  style ??= extractStyles(el.attribs.style ?? '');
  const {
    'transform-origin': transformOrigin = '',
    'transform-box': transformBox = null,
  } = style;

  // Support e.g. `76.028px 97.3736px`, `50% 50%`
  const [xPart, yPart] = transformOrigin.split(/\s+/);
  if (!xPart || !yPart) {
    return { transformOrigin: null, transformBox };
  }

  const [x, y] = [xPart, yPart].map((rep, i) => {
    /** @type {RegExpMatchArray | null} */ let match = null;
    if (match = rep.match(/^(-?\d+(?:.\d+)?)%$/)) {
      return (Number(match[1]) / 100) * (
        Number(el.attribs[i === 0 ? 'width' : 'height'] ?? '0')
      );
    } else if (match = rep.match(/^(-?\d+(?:.\d+)?)px$/)) {
      return Number(match[1]);
    } else {
      return null;
    }
  });

  if (Number.isFinite(x) && Number.isFinite(y)) {
    // console.log({ transformOrigin }, x, y);
    return {
      transformOrigin: tempVect.set(/** @type {number} */ (x), /** @type {number} */ (y)),
      transformBox,
    };
  } else {
    transformOrigin && warn(`${el.tagName}: ignored transform-origin with format "${transformOrigin}"`);
    return { transformOrigin: null, transformBox };
  }
}

const tempVect = new Vect;
