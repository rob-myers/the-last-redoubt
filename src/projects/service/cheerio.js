import { Element } from 'cheerio';
import { Poly, Rect, Mat } from '../geom';
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
 * @param {number} [scale] Non hull-symbols need to be scaled down by `1/5` to obtain world coords
 */
export function extractGeomsAt(api, topNodes, title, scale = 1) {
  const group = topNodes.find(x => hasTitle(api, x, title));
  return group ? extractGeoms(api, group, scale) : [];
}

/**
 * @param {import('cheerio').CheerioAPI} api
 * @param {Element} parent
 * @param {number} [scale]
 */
export function extractGeoms(api, parent, scale = 1) {
  const children = api(parent).children('rect, path, ellipse, image').toArray();
  return children.flatMap(x => extractGeom(api, x, scale)).map(x => x.precision(4).cleanFinalReps());
}

/**
 * @param {import('cheerio').CheerioAPI} api
 * @param {Element} el
 * @param {number} [scale]
 */
export function extractGeom(api, el, scale = 1) {
  const { tagName, attribs: a } = el;
  const output = /** @type {(Geom.Poly & { _ownTags: string[] })[]} */ ([]);
  const title = api(el).children('title').text() || null;
  const _ownTags = title ? title.split(' ') : [];

  if (tagName === 'rect' || tagName === 'image') {
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

  if (_ownTags.includes('symbol')) {
      // We can reference symbols inside other symbols,
      // in which case we must propagate orig origin/transform
      _ownTags.push(`_ownOrigin={x:${Number(a.x ?? 0) * scale},y:${Number(a.y ?? 0) * scale}}`);
  }

  // DOMMatrix not available server-side
  const { transformOrigin, transformBox } = extractTransformData(el);
  if (a.transform && transformOrigin) {
    const m = new Mat(a.transform);
    if (transformBox === 'fill-box') {
      if (!el.attribs.x || !el.attribs.y) {
        // broken when <path> lacks attribs x, y
        // 🚧 try computing bounding box of `pathEl.d`
        warn(`${title}: ${tagName}: unsupported "transform-box: fill-box" without x and y`);
      }
      transformOrigin.x += Number(el.attribs.x ?? '0');
      transformOrigin.y += Number(el.attribs.y ?? '0');
    }
    if (_ownTags.includes('symbol')) {
      const m2 = new Mat;
      m2.e -= transformOrigin.x * scale, m2.f -= transformOrigin.y * scale;
      m2.postMultiply(m.toArray());
      m2.e += transformOrigin.x * scale, m2.f += transformOrigin.y * scale;
      _ownTags.push(`_ownTransform=[${m2.toArray()}]`);
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
 * @returns {{ transformOrigin: Geom.VectJson | null; transformBox: string | null; }}
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
      transformOrigin: { x: /** @type {number} */ (x), y: /** @type {number} */ (y) },
      transformBox,
    };
  } else {
    transformOrigin && warn(`${el.tagName}: ignored transform-origin with format "${transformOrigin}"`);
    return { transformOrigin: null, transformBox };
  }
}

