import { assertNonNull, keys, testNever } from './generic';
import { npcWorldRadius } from './const';
import { Rect, Vect } from '../geom';
import { geom } from './geom';

/**
 * Choose scale factor s.t. npc radius becomes `14.4`.
 * - Starship Geomorphs grid is 60 * 60.
 * - Approx 1.5m * 1.5m hence npc radius ~ 36cm
 * @param {{ radius: number }} parsed 
 */
export function computeNpcScale(parsed) {
  return npcWorldRadius / parsed.radius;
}

/**
 * @param {NPC.ParsedNpc} parsed
 */
export function computeSpritesheetCss(parsed) {
  const scale = computeNpcScale(parsed);
  return `
.body {
  transform: scale(${scale});
}

${Object.values(parsed.animLookup).map(({ animName, frameAabb }) => `
  &.${animName} .body:not(.webp) {
    width: ${frameAabb.width}px;
    height: ${frameAabb.height}px;
    left: ${-frameAabb.width * 0.5}px;
    top: ${-frameAabb.height * 0.5}px;
    background-image: url('/assets/npc/${parsed.npcClassKey}/${parsed.npcClassKey}--${animName}.png');
  }
  &.${animName} .body.webp {
    width: ${frameAabb.width}px;
    height: ${frameAabb.height}px;
    left: ${-frameAabb.width * 0.5}px;
    top: ${-frameAabb.height * 0.5}px;
    background-image: url('/assets/npc/${parsed.npcClassKey}/${parsed.npcClassKey}--${animName}.webp');
  }
`).join('\n\n')}
`.trim();
}

/** @type {Record<NPC.ConfigBooleanKey, true>} */
const fromConfigBooleanKey = { canClickArrows: true, debug: true, debugPlayer: true, gmOutlines: true, hideGms: true, highlightWindows: true, localNav: true, localOutline: true, omnipresent: true, scriptDoors: true, showIds: true };

export const fromConfigBooleanKeys = keys(fromConfigBooleanKey);

/** @type {Record<NPC.FovMapAction, true>} */
const fromFovMapActionKey = { "hide": true, "show": true, "show-for-ms": true, "pause": true, "resume": true };

export const fovMapActionKeys = keys(fromFovMapActionKey);

/** @type {Record<NPC.NpcActionKey, true>} */
const fromNpcActionKey = { "add-decor": true, cancel: true, config: true, decor: true, do: true, events: true, get: true, light: true, "look-at": true, map: true, pause: true, resume: true, rm: true, "remove": true, "remove-decor": true, "rm-decor": true, "set-player": true };

/** @type {Record<NPC.NpcClassKey, true>} */
const fromNpcClassKey = { "first-human-npc": true, solomani: true, vilani: true, zhodani: true };

/**
 * @param {string} input 
 * @returns {input is NPC.ConfigBooleanKey}
 */
export function isConfigBooleanKey(input) {
  return input in fromConfigBooleanKey;
}

/**
 * @param {string} input 
 * @returns {input is NPC.FovMapAction}
 */
export function isFovMapAction(input) {
  return input in fromFovMapActionKey;
}

/**
 * @param {string} input 
 * @returns {input is NPC.NpcActionKey}
 */
export function isNpcActionKey(input) {
  return fromNpcActionKey[/** @type {NPC.NpcActionKey} */ (input)] ?? false;
}

/**
 * @param {string} input 
 * @returns {input is NPC.NpcClassKey}
 */
export function isNpcClassKey(input) {
  return input in fromNpcClassKey;
}

/**
 * 🚧 properly typed approach
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
      case "resume":
      case "rm":
      case "remove":
      case "set-player":
        opts = { npcKey: opts };
        break;
      case "config":
        opts = { configKey: [opts].concat(extras).join(' ') };
        break;
      case "do":
        opts = /** @type {NPC.NpcConfigOpts} */ ({ npcKey: opts, point: extras[0], params: extras.slice(1) });
        break;
      case "look-at":
        // npc look-at andros $( click 1 )
        opts = /** @type {NPC.NpcConfigOpts} */ ({ npcKey: opts, point: extras[0] });
        break;
      case "map":
        opts = /** @type {NPC.NpcConfigOpts} */ ({ mapAction: opts, timeMs: extras[0] });
        break;
      default:
        opts = {}; // we ignore key
        break;
    }
  } else {
    switch (action) {
      case "light":
        opts = /** @type {NPC.NpcConfigOpts} */ ({ point: opts, lit: extras[0] });
        break;
      default:
        return opts;
    }
  }
  return opts;
}

/**
 * Npc center vs static circle.
 * @param {NPC.NPC} npcA 
 * @param {NPC.DecorCircle} decorB
 * @returns {{ collisions: NPC.NpcCollision[]; startInside: boolean; }}
*/
export function predictNpcCircleCollision(npcA, decorB) {
  if (!npcA.isWalking()) {
    return { collisions: [], startInside: npcA.getPosition().distanceToSquared(decorB.center) < decorB.radius ** 2 };
  }
  if (!npcA.getWalkSegBounds(false).intersectsCentered(decorB.center.x, decorB.center.y, 2 * decorB.radius)) {
    return { collisions: [], startInside: false };
  }
  /**
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
  const iAB = segA.src.clone().sub(decorB.center);
  const distABSq = iAB.lengthSquared;
  const dpA = segA.tangent.dot(iAB);

  // strict inequality avoids degenerate case?
  const startInside = distABSq < decorB.radius ** 2;
  const inSqrt = (dpA ** 2) - distABSq + (decorB.radius ** 2);
  
  if (inSqrt <= 0) {// No solution, or glancing collision
    return { collisions: [], startInside };
  }
  
  const collisions = /** @type {NPC.NpcCollision[]} */ ([]);
  const speedA = npcA.getSpeed();
  /** Time at which npc is at @see {segA.dst} */
  const tMax = segA.src.distanceTo(segA.dst) / speedA;

  /** Earlier of the two solutions */
  const t1 = (-dpA - Math.sqrt(inSqrt)) * (1 / speedA);
  if (t1 > tMax) {// Early exit
    return { collisions: [], startInside };
  }

  /** Later of the two solutions */
  let t2 = (-dpA + Math.sqrt(inSqrt)) * (1 / speedA);
  if (t1 >= 0) {
    collisions.push({ seconds: t1, distA: t1 * speedA, distB: 0 });
  }
  if (t2 >= 0 && t2 <= tMax) {
    collisions.push({ seconds: t2, distA: t2 * speedA, distB: 0 });
  }

  return { collisions, startInside };
}

/**
 * @param {NPC.NPC} npcA Assumed to be moving
 * @param {NPC.NPC} npcB May not be moving
 * @returns {NPC.NpcCollision | null}
 */
export function predictNpcNpcCollision(npcA, npcB) {
  if (!npcA.isWalking()) {
    return null; // Maybe stopped in time for event to fire?
  }
  if (npcB.isWalking()) {
    if (!npcA.getWalkSegBounds(true).intersects(npcB.getWalkSegBounds(true))) {
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
     * Subsequent collisions handled via 'vertex' or 'stopped-walking'.
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

  } else {// npcB is standing still
    if (!npcA.getWalkSegBounds(true).intersects(npcB.anim.staticBounds)) {
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
 * Npc center vs static polygon.
 * @param {NPC.NPC} npcA viewed as single point
 * @param {Geom.VectJson[]} outline static polygon outline
 * @param {Geom.Rect} [rect] defaults to `Rect.fromPoints(...outline)`
 * @returns {{ collisions: NPC.NpcCollision[]; startInside: boolean; }}
 */
export function predictNpcPolygonCollision(npcA, outline, rect) {
  if (outline.length < 3) {
    return { collisions: [], startInside: false };
  }
  if (!npcA.getTarget()) {// Not walking or at final point
    return { collisions: [], startInside: geom.outlineContains(outline, npcA.getPosition(), null) };
  }
  if (!npcA.getWalkSegBounds(false).intersects(rect || Rect.fromPoints(...outline))) {
    return { collisions: [], startInside: false };
  }
  
  const segA = assertNonNull(npcA.getLineSeg());
  const speedA = npcA.getSpeed();
  const startInside = geom.outlineContains(outline, segA.src, null);

  outline.push(outline[0]);
  // 🚧 avoid checking every segment
  // - restrict to +ve dot product inside
  // - restrict to -ve dot product outside
  const distances = outline.reduce((agg, p, i) => {
    if (outline[i + 1]) {
      /** λ ∊ [0, 1] of `segA.dst - segA.src` */
      const scaleFactor = geom.getLineSegsIntersection(segA.src, segA.dst, p, outline[i + 1]);
      (scaleFactor !== null) && agg.push(scaleFactor * segA.src.distanceTo(segA.dst));
    }
    return agg;
  }, /** @type {number[]} */ ([]));
  outline.pop();

  distances.sort((a, b) => a < b ? -1 : 1);

  return {
    collisions: distances.map(distance => ({ seconds: distance / speedA, distA: distance, distB: 0 })),
    startInside,
  };
}

/**
 * @param {NPC.DecorDef} [input]
 * @returns {boolean}
 */
export function verifyDecor(input) {
  if (!input) {
    return false;
  }
  switch (input.type) {
    case 'circle':
      return Vect.isVectJson(input.center) && typeof input.radius === 'number';
    case 'group':
      return Array.isArray(input.items) && input.items.every(item => verifyDecor(item));
    case 'path':
      return input?.path?.every(/** @param {*} x */ (x) => Vect.isVectJson(x));
    case 'point':
      // We permit `input.tags` and `input.meta` to be undefined
      return Vect.isVectJson(input);
    case 'rect':
      return [input.x, input.y, input.width, input.height].every(x => Number.isFinite(x));
    default:
      throw testNever(input, { override: `decor has unrecognised type: ${JSON.stringify(input)}` });
  }
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
