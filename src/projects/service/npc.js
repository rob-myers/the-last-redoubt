import cheerio, { Element } from 'cheerio';
import { Image, createCanvas, Canvas } from 'canvas';
import path from 'path';

import { assertNonNull } from './generic';
import { Rect, Vect } from '../geom';
import { extractGeom, extractGeomsAt, hasTitle, matchesTitle } from './cheerio';
import { saveCanvasAsFile } from './file';
import { warn } from './log';

/**
 * @param {NPC.NpcAnimCheerio} anim 
 * @param {number} zoom
 */
async function drawAnimSpriteSheet(anim, zoom) {
  const frameCount = anim.frameCount;
  const canvas = createCanvas(anim.aabb.width * frameCount, anim.aabb.height);
  const ctxt = canvas.getContext('2d');

  for (let i = 0; i < frameCount; i++) {
    await drawFrame(anim, i, canvas, zoom);
    // Spritesheet rendered from left to right
    ctxt.translate(anim.aabb.width, 0);
  }

  ctxt.restore();
  return canvas;
}

/**
 * - Render by recreating an SVG and assigning as Image src.
 * - Permits complex SVG <path>s, non-trivial to draw directly into canvas.
 * - Need <def> e.g. for head symbol.
 * @param {NPC.NpcAnimCheerio} anim 
 * @param {number} frameId 0-based frame index
 * @param {Canvas} canvas 
 * @param {number} zoom
 */
async function drawFrame(anim, frameId, canvas, zoom) {
  const group = anim.frameNodes[frameId];

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      xmlns:bx="https://boxy-svg.com"
      viewBox="${
        // We zoom the SVG here
        Rect.fromJson(anim.aabb).clone().scale(1/zoom).toString()
      }"
      width="${anim.aabb.width}"
      height="${anim.aabb.height}"
    >
      ${anim.defsNode ? cheerio.html(anim.defsNode) : ''}
      ${cheerio.html(group)}
    </svg>
  `;
  // console.log(svg)

  const image = new Image;
  await new Promise(resolve => {
    image.onload = () => /** @type {*} */ (resolve)();
    image.src = Buffer.from(svg, 'utf-8');
  });

  canvas.getContext('2d').drawImage(image, 0, 0);
}

/**
 * @param {string} npcName 
 * @param {string} svgContents
 * @param {number} [zoom] 
 * @returns {NPC.ParsedNpcCheerio}
 */
export function parseNpc(npcName, svgContents, zoom = 1) {
  const $ = cheerio.load(svgContents);
  const topNodes = Array.from($('svg > *'));

  const metaGeoms = extractGeomsAt($, topNodes, 'meta');
  const boundsGeoms = metaGeoms.filter(x => x._ownTags[1] === 'bounds');
  const animMetas = boundsGeoms.map(x => ({ animName: x._ownTags[0], aabb: x.rect.scale(zoom) }));
  const symbolLookup = extractDefSymbols($, topNodes);
  console.log('parseNpc found:', { animMetas, symbolLookup });

  // Remove <image>s with visibility hidden (probably used for tracing)
  // They slow the rendering process
  Array.from($('image'))
    .filter(x => (x.attribs.style || '').includes('visibility: hidden;'))
    .forEach(x => $(x).remove());
  
  // Hide any rectangle with tag meta e.g. contact points in frames
  Array.from($('rect'))
    .filter(x => matchesTitle($, x, /(?:^| )meta(?:$| )/))
    .forEach(x => x.attribs.style = (x.attribs.style || '') + 'visibility: hidden;')

  return {
    npcName,
    animLookup: animMetas
      .reduce((agg, { animName, aabb }) => {
        const defsNode = topNodes.find(x => x.type === 'tag' && x.name === 'defs') || null;
        const frameNodes = extractNpcFrameNodes($, topNodes, animName);

        /** @type {NPC.NpcAnimMeta['contacts']} */
        const contacts = frameNodes.map((group, frameId) => {
          const polys = $(group).find('rect').toArray()
            .flatMap(x => extractGeom($, x)).filter(x => ['meta', 'contact']
            .every(tag => x._ownTags.includes(tag)));
          const left = polys.find(x => x._ownTags.includes('left'));
          const right = polys.find(x => x._ownTags.includes('right'));
          return {
            left: left ? left.center.scale(zoom).json : undefined,
            right: right ? right.center.scale(zoom).json : undefined,
          };
        });

        /** One more than frame count i.e. distances travelled from last -> first */
        const deltas = contacts.concat(contacts[0]).map(({ left: leftFoot, right: rightFoot }, i) => {
          const [prevLeft, prevRight] = [contacts[i - 1]?.left, contacts[i - 1]?.right];
          return (// For walk, exactly one of 1st two summands should be non-zero
            (!leftFoot || !prevLeft ? 0 : Math.abs(leftFoot.x - prevLeft.x)) ||
            (!rightFoot || !prevRight ? 0 : Math.abs(rightFoot.x - prevRight.x)) || 0
          );
        });

        agg[animName] = {
          animName,
          aabb,
          frameCount: frameNodes.length,
          defsNode,
          frameNodes,
          contacts,
          deltas,
          totalDist: deltas.reduce((sum, x) => sum + x, 0),
        };
        return agg;
      }, /** @type {NPC.ParsedNpcCheerio['animLookup']} */ ({})),
    zoom,
  };
}

/**
 * @param {import('cheerio').CheerioAPI} api
 * @param {Element[]} topNodes
 */
function extractDefSymbols(api, topNodes) {
  const svgDefs = topNodes.find(x => x.type === 'tag' && x.name === 'defs');
  const svgSymbols = api(svgDefs).children('symbol').toArray();
  
  const lookup = svgSymbols.reduce((agg, el) => {
    const id = el.attribs.id;
    const title = api(el).children('title').text() || null;
    if (id !== title) {
      warn(`saw symbol with id "${id}" and distinct title "${title}"`);
    }
    // NOTE symbol must have top-level group(s)
    agg[id] = api(el).children('g').toArray();
    return agg;
  }, /** @type {Record<string, Element[]>} */ ({}));

  return lookup;
}

/**
 * @param {import('cheerio').CheerioAPI} api Cheerio
 * @param {Element[]} topNodes Topmost children of <svg>
 * @param {string} title Title of <g> to extract
 */
function extractNpcFrameNodes(api, topNodes, title) {
  /**
   * The group named `title` (e.g. `"walk"`), itself containing
   * groups of frames named e.g. `"npc-1"`, `"npc-2"`, etc.
   */
  const animGroup = topNodes.find(x => hasTitle(api, x, title));
  /**
   * The groups inside the group named `animGroup`.
   * The 1st one might be named `"npc-1"`.
   */
  const groups = /** @type {Element[]} */ (animGroup?.children??[])
    .filter(x => x.name === 'g')
  
  // Override visibility: hidden
  groups.forEach(group => {
    group.attribs.style = (group.attribs.style || '')
      + 'visibility: visible;'
  });
  return groups;
}

/**
 * @param {string} input 
 * @returns {input is NPC.NpcActionKey}
 */
export function isNpcActionKey(input) {
  return fromActionKey[/** @type {NPC.NpcActionKey} */ (input)]??false;
}

/**
 * @param {NPC.NpcActionKey} action
 * @param {undefined | string | NPC.NpcConfigOpts} opts
 * @param {any[]} extras 
 */
export function normalizeNpcCommandOpts(action, opts = {}, extras) {
  if (typeof opts === "string") {
    switch (action) {
      case "decor":
      case "remove-decor":
      case "rm-decor":
        opts = { decorKey: opts };
        break;
      case "cancel":
      case "get":
      case "pause":
      case "play":
      case "set-player":
        opts = { npcKey: opts };
        break;
      case "config":
        opts = { configKey: /** @type {NPC.NpcConfigOpts['configKey']} */ (opts) };
        break;
      case "look-at":
        // npc look-at andros $( click 1 )
        opts = /** @type {NPC.NpcConfigOpts} */ ({ npcKey: opts, point: extras[0] });
        break;
      default:
        opts = {}; // we ignore key
        break;
    }
  }
  return opts;
}

/** @type {Record<NPC.NpcActionKey, true>} */
const fromActionKey = { "add-decor": true, cancel: true, config: true, decor: true, get: true, "look-at": true, pause: true, play: true, "remove-decor": true, "rm-decor": true, "set-player": true };

/**
 * @param {NPC.NPC} npcA Assumed to be moving
 * @param {NPC.NPC} npcB May not be moving
 * @returns {NPC.NpcCollision | null}
 */
export function predictNpcNpcCollision(npcA, npcB) {
  if (npcB.isWalking()) {
    if (!npcA.getWalkSegBounds().intersects(npcB.getWalkSegBounds())) {
      return null;
    }
    /**
     * seg vs seg
     * 
     * Solving `a.t^2 + b.t + c ≤ 0`,
     * - `a := speedA^2 + speedB^2 - 2.speedA.speedB.dirDp`
     * - `b := 2.(speedA.dpA - speedB.dpB)`
     * - `c := distABSq - minDist^2`
     * 
     * Solutions are
     * ```js
     * (-b ± √(b^2 - 4ac)) / 2a // i.e.
     * (-b ± √inSqrt) / 2a
     * ```
     */
    const segA = assertNonNull(npcA.getLineSeg());
    const segB = assertNonNull(npcB.getLineSeg());
    const dirDp = segA.tangent.dot(segB.tangent);
    /** Vector from npc B to A */
    const iAB = segA.src.clone().sub(segB.src);
    const distABSq = iAB.lengthSquared;
    const dpA = segA.tangent.dot(iAB);
    const dpB = segB.tangent.dot(iAB);
    const speedA = npcA.getSpeed();
    const speedB = npcB.getSpeed();
    const minDistSq = ((npcA.getRadius() + npcB.getRadius()) * 0.9) ** 2;

    if (dpA >= 0 || dpB <= 0) {// NPCs not moving towards each other
      return null;
    }
    if (distABSq <= minDistSq) {// Already colliding
      return { seconds: 0, distA: 0, distB: 0 };
    }

    const a = (speedA ** 2) + (speedB ** 2) - 2 * speedA * speedB * dirDp;
    const b = 2 * (speedA * dpA - speedB * dpB);
    const c = distABSq - minDistSq;

    const inSqrt = (b ** 2) - (4 * a * c);
    const timeA = segA.src.distanceTo(segA.dst) / speedA;
    const timeB = segB.src.distanceTo(segB.dst) / speedB;
    /**
     * Linear motion only valid until 1st target reached
     * Subsequent collisions handled via 'start-seg' or 'stopped-walking'.
     */
    const maxTime = Math.min(timeA, timeB);

    /** Potential solution to quadratic (seconds) */
    let t = 0;
    if (
      inSqrt > 0 &&
      (t = (-b - Math.sqrt(inSqrt)) / (2 * a)) <= maxTime
    ) {// 0 <= seconds <= time to reach segA.dst
      return { seconds: t, distA: t * speedA, distB: t * speedB };
    } else {
      return null;
    }

  } else {
    // npcB is standing still
    if (!npcA.getWalkSegBounds().intersects(npcB.anim.staticBounds)) {
      return null;
    }
    /**
     * seg vs static
     * 
     * Solving `a.t^2 + b.t + c ≤ 0`,
     * - `a := speedA^2`
     * - `b := 2.speedA.dpA`
     * - `c := distABSq - minDist^2`
     * 
     * Solutions are
     * ```js
     * (-b ± √(b^2 - 4ac)) / 2a // i.e.
     * (-b ± 2.speedA.√inSqrt) / 2a
     * ```
     */
    const segA = assertNonNull(npcA.getLineSeg());
    const iAB = segA.src.clone().sub(npcB.getPosition());
    const distABSq = iAB.lengthSquared;
    const dpA = segA.tangent.dot(iAB);
    const speedA = npcA.getSpeed();
    const minDistSq = ((npcA.getRadius() + npcB.getRadius()) * 0.9) ** 2;

    if (dpA >= 0) {// NPC A not moving towards B
      return null;
    }
    if (distABSq <= minDistSq) {// Already colliding
      return { seconds: 0, distA: 0, distB: 0 };
    }

    const inSqrt = (dpA ** 2) - distABSq + minDistSq;

    /** Potential solution to quadratic (seconds) */
    let t = 0;
    if (
      inSqrt > 0 &&
      (t = (-dpA - Math.sqrt(inSqrt)) * (1 / speedA)) <=
      (segA.src.distanceTo(segA.dst) / speedA)
    ) {
      return { seconds: t, distA: t * speedA, distB: 0 };
    } else {
      return null;
    }
  }
}

/**
 * @param {NPC.NPC} npc Assumed to be walking
 * @param {Geom.Seg} seg Fixed seg
 * @returns {NPC.NpcSegCollision | null}
 */
export function predictNpcSegCollision(npc, seg) {
  const rect = Rect.fromPoints(seg.src, seg.dst);
  if (!npc.getWalkSegBounds().intersects(rect)) {
    return null;
  }

  const walkSeg = assertNonNull(npc.getLineSeg());
  const walkDelta = walkSeg.dst.clone().sub(walkSeg.src);
  const walkDir = walkDelta.clone().normalize(); // \delta
  const walkMax = walkDelta.length;
  
  const npcSpeed = npc.getSpeed(); // u > 0
  const timeMax = walkMax / npcSpeed; // t_\Omega
  
  /**
   * Fixed segment:
   * > `p(λ) := seg.src + λ . segDir`
   * > where `0 ≤ λ ≤ segMax`
   */
  // 🖊 seg.src ~ \alpha, seg.dst ~ \beta
  const segDelta = Vect.from(seg.dst).sub(seg.src);
  const segDir = segDelta.clone().normalize(); // \tau
  const segMax = segDelta.length;
  
  for (const npcSeg of npc.segs) {
    /**
     * A line segment attached to npc:
     * > `p_i(t, λ_i) := npcSeg.src + ut . walkDir + λ_i . npcSegDir` where:
     * > - 0 ≤ t ≤ tMax
     * > - 0 ≤ λ_i ≤ npcSegMax
     */
    // npcSec.src ~ \alpha_i, npcSec.dst ~ \beta_i
    const npcSegDelta = Vect.from(npcSeg.dst).sub(npcSeg.src);
    const npcSegDir = npcSegDelta.clone().normalize(); // \tau_i
    const npcSegMax = npcSegDelta.length;

    /**
     * Solving `p_i(t, λ_i) = p(λ)` i.e.
     * 1. npcSeg.src.x + u.t.walkDir.x + λ_i . npcSegDir.x = seg.src.x + λ . segDir.x
     * 2. npcSeg.src.y + u.t.walkDir.y + λ_i . npcSegDir.y = seg.src.y + λ . segDir.y
     */

    if (npcSegDir.x === 0) {
      // Let 0 ≤ t ≤ timeMax, 0 ≤ λ ≤ segMax,
      // (npcSpeed . walkDir_x .​ t) - (npcSegDir.x .​ λ) + (npcSeg.src.x ​- seg.src.x) = 0
      if (walkDir.x === 0 && segDir.x === 0) {
        // Walk direction and segments are parallel
        continue; // We ignore glancing collisions
      } else if (segDir.x === 0) {// Segments are parallel
        // If they collide the time is unique
        const t = (seg.src.x - npcSeg.src.x) / (npcSpeed * walkDir.x);
        if (0 <= t && t <= timeMax) return { seconds: t, dist: t * npcSpeed };
        continue;
      } else if (walkDir.x === 0) {
        // via (1) λ = (npcSeg.src.x - seg.src.x) / segDir.x
        // via (2) λ_i + (npcSpeed . t) - (λ . segDir.y) + (npcSeg.src.y - seg.src.y) = 0
        // thus:
        // ut = -λ_i + (seg.src.x - npcSeg.src.x).(segDir.x/segDir.x) + (seg.src.y - npcSeg.src.y)
        // 🚧 intersect interval and minimize
      } else {
        // Since segDir.x and walkDir.x are non-zero, (1) becomes:
        // ut = (segDir.x / walkDir.x) λ + (seg.src.x - npcSeg.src.x) / walkDir.x
        // 🚧 intersect interval and minimize
      }
    } else {// npcSegDir.x non-zero,
      // via (1) λ_i = -ut . (walkDir.x/npcSegDir.x) + λ . (segDir.x/npcSegDir.x) + (seg.src.x - npcSeg.src.x)/npcSegDir.x
      // via (2) a.t + b.λ + c = 0, where:
      const a = npcSpeed * walkDir.y - npcSpeed * walkDir.x * (npcSegDir.y / npcSegDir.x);
      const b = -segDir.y + segDir.x * (npcSegDir.y / npcSegDir.x);
      const c = (seg.src.x - npcSeg.src.x) * (npcSegDir.y / npcSegDir.x) + npcSeg.src.y - seg.src.y;
      if (a === 0 && b === 0) {// Then c = 0 too, so
        // npcSegDir.y/npcSegDir.x
        // = walkDir.y / walkDir.x 👈 (walkDir.x non-zero else walkDir 0)
        // = segDir.y / segDir.x 👈 (segDir.x non-zero else sigDir 0)
        // = (seg.src.y - npcSeg.src.y) / (seg.src.x - npcSeg.src.x) 👈 (assume seg.src !== npcSeg.src)
        // Thus walk dir, fixed seg and vector difference of seg starts are parallel
        // 🚧 /sketches should include "👈" reasoning
        continue; // We ignore glancing collisions
      } else if (b === 0) {// Segments are parallel
        // If they collide the time is unique
        const t = -c / a;
        if (0 <= t && t <= timeMax) return { seconds: t, dist: t * npcSpeed };
        continue;
      } else if (a === 0) {
        // 🚧 + adjust /sketches
        // Possibly missing case where npcSegDir.y === walkDir.y === 0
        // IDEA Know λ; Know npcSegDir.x === delta.x === 1; Subst into (1) and get f(t, λ_i) = 0
        // Hopefully this can be unified with argument when npcSegDir.y !== 0
      } else {
        // t = -b/a . λ - c
        // 🚧 intersect interval and minimize
      }
    }
  }

  return null;
}

/**
 * @param {NPC.ParsedNpcCheerio} parsed 
 * @param {string} outputDir 
 * @param {{ zoom: number; animNames: string[] }} opts
 */
export async function renderNpcSpriteSheets(parsed, outputDir, opts) {
  const { animNames, zoom } = opts;

  const anims = animNames.length
    ? Object.values(parsed.animLookup).filter(x => animNames.includes(x.animName))
    : Object.values(parsed.animLookup);

  for (const anim of anims) {
    const canvas = await drawAnimSpriteSheet(anim, zoom);
    const outputPath = path.resolve(outputDir, `${parsed.npcName}--${anim.animName}.png`);
    saveCanvasAsFile(canvas, outputPath);
  }
}

/** @param {NPC.DecorDef} [input] */
export function verifyDecor(input) {
  if (!input) {
    return false;
  }
  if (input.type === 'circle' && Vect.isVectJson(input.center) && typeof input.radius === 'number') {
    return true;
  }
  if (input.type === 'seg' && Vect.isVectJson(input.src) && Vect.isVectJson(input.dst)) {
    return true;
  }
  if (input.type === 'path' && input?.path?.every(/** @param {*} x */ (x) => Vect.isVectJson(x))) {
    return true;
  }
  return false;
}

/** @param {NPC.GlobalNavPath} input */
export function verifyGlobalNavPath(input) {
  let x = /** @type {Partial<NPC.GlobalNavPath>} */ (input);
  return x?.key === 'global-nav'
    && x.fullPath?.every?.(Vect.isVectJson)
    && Array.isArray(x.navMetas)
    // TODO check navMetas
    || false;
}

/** @param {NPC.LocalNavPath} input */
export function verifyLocalNavPath(input) {
  let x = /** @type {Partial<NPC.LocalNavPath>} */ (input);
  return x?.key === 'local-nav'
    && x.fullPath?.every?.(Vect.isVectJson)
    // TODO check navMetas
    || false;
}
