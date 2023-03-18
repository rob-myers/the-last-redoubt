import { assertNonNull, testNever } from './generic';
import { Vect } from '../geom';
import { geom } from './geom';

/**
 * Choose scale factor s.t. npc radius becomes `14.4`.
 * - Starship Geomorphs grid is 60 * 60.
 * - Approx 1.5m * 1.5m hence npc radius ~ 36cm
 * @param {NPC.ParsedNpc} parsed 
 */
export function computeNpcScale(parsed) {
  return 14.4 / parsed.radius;
}

/**
 * @param {NPC.ParsedNpc} parsed
 * @param {number} offsetRadians
 * @param {number} scale
 */
export function computeSpritesheetCss(parsed, offsetRadians, scale) {
  return `
.body {
  transform: rotate(${offsetRadians}rad) scale(${scale});
}

${Object.keys(parsed.animLookup).map((animName) => `
  &.${animName} .body:not(.webp) {
    width: ${parsed.aabb.width}px;
    height: ${parsed.aabb.height}px;
    left: ${-parsed.aabb.width * 0.5}px;
    top: ${-parsed.aabb.height * 0.5}px;
    background-image: url('/assets/npc/${parsed.npcJsonKey}/${parsed.npcJsonKey}--${animName}.png');
  }
  &.${animName} .body.webp {
    width: ${parsed.aabb.width}px;
    height: ${parsed.aabb.height}px;
    left: ${-parsed.aabb.width * 0.5}px;
    top: ${-parsed.aabb.height * 0.5}px;
    background-image: url('/assets/npc/${parsed.npcJsonKey}/${parsed.npcJsonKey}--${animName}.webp');
  }
`).join('\n\n')}
`.trim();
}

/**
 * Mutates, but also returns mutated for type propagation.
 * @template {Geomorph.PointMeta} T
 * @param {T} meta
 * @param {Geom.Mat} gmMatrix
 * @returns {T & NPC.ExtendDecorPointMeta}
 */
export function extendDecorMeta(meta, gmMatrix) {
  const doable = hasTag(meta, ['decor', 'do']);
  
  /** This final `orient-{deg}` should be orientation relative to transformed room */
  const roomOrientDegrees = Object.keys(meta).reduce((agg, tag) =>
    tag.startsWith('orient-') ? Number(tag.slice('orient-'.length)) : agg,
    /** @type {undefined | number} */ (undefined),
  );

  /** Compute orientation relative to world coords */
  const worldOrientRadians = roomOrientDegrees === undefined
    ? undefined
    : gmMatrix.transformAngle(roomOrientDegrees * (Math.PI/180));

  /** @type {NPC.ExtendDecorPointMeta} */
  const extension = {
    doable,
    orientRadians: worldOrientRadians,
    spawnable: doable && hasTag(meta, 'stand', 'sit', 'lie'),
    targetPos: /** @type {*} */ (meta.targetPos), // For type propagation
    ui: true,
  };
  
  return Object.assign(meta, extension);
}

/** @type {Record<NPC.NpcActionKey, true>} */
const fromActionKey = { "add-decor": true, cancel: true, config: true, decor: true, do: true, events: true, get: true, "look-at": true, pause: true, resume: true, rm: true, "remove": true, "remove-decor": true, "rm-decor": true, "set-player": true };

/**
 * @param {Geomorph.PointMeta} meta
 * @param {(string | string[])[]} specs 
 * @returns {boolean}
 */
function hasTag(meta, ...specs) {
  return specs.some(spec =>
    Array.isArray(spec)
      ? spec.every(tag => meta[tag] === true)
      : meta[spec] === true
  );
}

/**
 * @param {string} input 
 * @returns {input is NPC.NpcActionKey}
 */
export function isNpcActionKey(input) {
  return fromActionKey[/** @type {NPC.NpcActionKey} */ (input)] ?? false;
}

/** @type {Record<NPC.ConfigBooleanKey, true>} */
const fromConfigBooleanKey = { "canClickArrows": true, "debug": true, "gmOutlines": true, "highlightWindows": true, "localNav": true, "localOutline": true, "omnipresent": true, "showIds": true };

/**
 * @param {string} input 
 * @returns {input is NPC.ConfigBooleanKey}
 */
export function isConfigBooleanKey(input) {
  return fromConfigBooleanKey[/** @type {NPC.ConfigBooleanKey} */ (input)] ?? false;
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
      case "resume":
      case "rm":
      case "remove":
      case "set-player":
        opts = { npcKey: opts };
        break;
      case "config":
        opts = { configKey: [opts].concat(extras).join(' ') };
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
  if (!npcA.getWalkSegBounds().intersectsCentered(decorB.center.x, decorB.center.y, 2 * decorB.radius)) {
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
    return null; // Saw segA assertNonNull fail 🤔
  }
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

  } else {// npcB is standing still
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
 * Npc center vs static polygon.
 * @param {NPC.NPC} npcA viewed as single point
 * @param {Geom.Poly} polygon static polygon
 * @param {Geom.Rect} [rect] default `polygon.rect`
 * @returns {{ collisions: NPC.NpcCollision[]; startInside: boolean; }}
 */
export function predictNpcPolygonCollision(npcA, polygon, rect = polygon.rect) {
  const vs = polygon.outline;
  if (vs.length < 3) {
    return { collisions: [], startInside: false };
  }
  if (!npcA.isWalking()) {
    return { collisions: [], startInside: geom.outlineContains(vs, npcA.getPosition(), null) };
  }
  if (!npcA.getWalkSegBounds().intersects(rect)) {
    return { collisions: [], startInside: false };
  }
  
  const segA = assertNonNull(npcA.getLineSeg());
  const speedA = npcA.getSpeed();
  const startInside = geom.outlineContains(vs, segA.src, null);

  vs.push(vs[0]);
  // 🚧 avoid checking every segment e.g. only need to check two for angled rects
  const times = vs.reduce((agg, p, i) => {
    if (vs[i + 1]) {
      const time = geom.getLineSegsIntersection(segA.src, segA.dst, p, vs[i + 1]);
      (time !== null) && agg.push(time);
    }
    return agg;
  }, /** @type {number[]} */ ([]));
  vs.pop();
  times.sort((a, b) => a < b ? -1 : 1);

  return {
    collisions: times.map(t => ({ seconds: t, distA: t * speedA, distB: 0 })),
    startInside,
  };
}

/** @param {NPC.DecorDef} [input] */
export function verifyDecor(input) {
  if (!input) {
    return false;
  }
  switch (input.type) {
    case 'circle':
      return Vect.isVectJson(input.center) && typeof input.radius === 'number';
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
