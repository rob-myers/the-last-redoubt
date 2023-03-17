import { parseSVG, makeAbsolute } from 'svg-path-parser';
import { Mat, Poly, Rect, Vect } from '../geom';

class geomServiceClass {
  /**
   * @param {Geom.AngledRect<Geom.Rect>} input 
   * @returns {Geom.Poly}
   */
  angledRectToPoly(input) {
    const poly = Poly.fromRect(input.baseRect);
    poly.translate(-input.baseRect.x, -input.baseRect.y);
    poly.applyMatrix((new Mat).setRotation(input.angle));
    poly.translate(input.baseRect.x, input.baseRect.y);
    return poly;
  }
  
  /**
   * https://github.com/davidfig/intersects/blob/master/polygon-circle.js
   * @param {Geom.VectJson} center 
   * @param {number} radius 
   * @param {Geom.Poly} convexPoly 
   */
  circleIntersectsConvexPolygon(center, radius, convexPoly) {
    if (this.outlineContains(convexPoly.outline, center)) {
      return true;
    }
    const vs = convexPoly.outline;
    const count = vs.length;

    for (let i = 0; i < count - 1; i++) {
      if (geom.lineSegIntersectsCircle(vs[i], vs[i + 1], center, radius)) {
        return true;
      }
    }
    return geom.lineSegIntersectsCircle(vs[0], vs[count - 1], center, radius);
  }

  /**
   * Return the two compass points with angle
   * nearest to direction.
   * @param {Vect} p 
   * @returns {[Geom.Direction, Geom.Direction]}
   */
  compassPoints(p) {
    if (p.x > 0) {
      if (p.y > 0) {
        return p.x > p.y ? ([1, 2]) : [2, 1]; // { 'e', 's' }
      } else {
        return p.x > p.y ? [1, 0] : [0, 1]; // { 'e', 'n' }
      }
    } else {
      if (p.y > 0) {
        return -p.x > p.y ? [3, 2] : [2, 3]; // { 'w', 's' }
      } else {
        return -p.x > -p.y ? [3, 0] : [0, 3]; // { 'w', 'n' }
      }
    }
  }

  /**
   * See Separating Axis Theorem for convex polygons.
   * https://github.com/davidfig/intersects/blob/9fba4c88dcf28998ced7df7c6e744646eac1917d/polygon-polygon.js#L10
   * @param {Geom.VectJson[]} ps1 
   * @param {Geom.VectJson[]} ps2 
   */
  convexPolysIntersect(ps1, ps2) {
    const polygons = [ps1, ps2];
    let minA, maxA, projected, minB, maxB, j;
    for (let i = 0; i < polygons.length; i++) {
      let polygon = polygons[i];
      for (let i1 = 0; i1 < polygon.length; i1++) {
        let i2 = (i1 + 1) % polygon.length;
        let normal = { x: polygon[i2].y - polygon[i1].y, y: polygon[i1].x - polygon[i2].x };
        minA = maxA = null
        for (j = 0; j < ps1.length; j++) {
          projected = normal.x * ps1[j].x + normal.y * ps1[j].y;
          if (minA === null || projected < minA) {
            minA = projected;
          }
          if (maxA === null || projected > maxA) {
            maxA = projected;
          }
        }
        minB = maxB = null;
        for (j = 0; j < ps2.length; j++) {
          projected = normal.x * ps2[j].x + normal.y * ps2[j].y;
          if (minB === null || projected < minB) {
            minB = projected;
          }
          if (maxB === null || projected > maxB) {
            maxB = projected
          }
        }
        // @ts-ignore
        if (maxA < minB || maxB < minA) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Create a new inset or outset version of polygon,
   * by cutting/unioning quads.
   * - assume outer points have anticlockwise orientation.
   * - assume holes have clockwise orientation.
   * @param {Geom.Poly} polygon
   * @param {number} amount
   */
  createInset(polygon, amount) {
    if (amount === 0) return [polygon.clone()];
    polygon.cleanFinalReps(); // Required

    // Compute 4-gons inset or outset along edge normals by `amount`
    const [outerQuads, ...holesQuads] = [
      {
        ring: polygon.outline,
        inset: this.insetRing(polygon.outline, amount),
      },
      ...polygon.holes.map(ring => ({
        ring,
        inset: this.insetRing(ring, amount),
      }))
    ].map(({ ring, inset }) =>
      ring.map((_, i) =>
        new Poly([
          ring[i].clone(),
          inset[i],
          inset[(i + 1) % ring.length],
          ring[(i + 1) % ring.length].clone()
        ]))
    );

    if (amount > 0) {// Inset
      return Poly.cutOut(outerQuads.concat(...holesQuads), [polygon.clone()]);
    } else {// Outset
      return Poly.union([polygon.clone()].concat(outerQuads, ...holesQuads));
    }
  }

  /**
   * @param {Geom.Poly} polygon 
   * @param {number} amount 
   */
  createOutset(polygon, amount) {
    return this.createInset(polygon, -amount);
  }

  /**
   * @param {Geom.VectJson[]} candidates 
   * @param {Geom.VectJson} target 
   * @param {number} [maxDistSqr] maximum distance permitted
   */
  findClosestPoint(candidates, target, maxDistSqr = Number.POSITIVE_INFINITY) {
    let minSeenDistSqr = Number.POSITIVE_INFINITY;
    let currDistSqr = 0;
    tempVect.copy(target);
    return candidates.reduce((closest, candidate) => {
      if (
        (currDistSqr = tempVect.distanceToSquared(candidate)) < minSeenDistSqr
        && (currDistSqr <= maxDistSqr)
      ) {
        minSeenDistSqr = currDistSqr;
        return candidate;
      } else {
        return closest;
      }
    }, /** @type {null | Geom.VectJson} */ (null));
  }

  /**
   * Inset/outset a ring by amount.
   * @private
   * @param {Vect[]} ring 
   * @param {number} amount 
   * @returns {Vect[]}
   */
  insetRing(ring, amount) {
    const poly = new Poly(ring);
    const tangents = poly.tangents.outer;
    const edges = ring.map((p, i) => /** @type {[Vect, Vect]} */ ([
      p.clone().translate(amount * -tangents[i].y, amount * tangents[i].x),
      ring[(i + 1) % ring.length].clone().translate(amount * -tangents[i].y, amount * tangents[i].x)
    ]));
    return edges.map((edge, i) => {
      const nextIndex = (i + 1) % edges.length;
      const nextEdge = edges[nextIndex];
      const lambda = geom.getLinesIntersect(
        edge[1],
        tangents[i],
        nextEdge[0],
        tangents[nextIndex]
      );
      return lambda
        ? edge[1].translate(lambda * tangents[i].x, lambda * tangents[i].y)
        : Vect.average([edge[1], nextEdge[0]]); // Fallback
    });
  }

  /**
   * https://github.com/davidfig/intersects/blob/master/line-polygon.js
   * Does line segment intersect polygon?
   * - we ignore holes
   * @param {Geom.VectJson} u 
   * @param {Geom.VectJson} v 
   * @param {Geom.Poly} polygon Only outline taken into consideration
   * @param {number} [tolerance] 
   */
  lineSegIntersectsPolygon(u, v, polygon, tolerance) {
    const points = polygon.outline
    const length = points.length
  
    // check if first point is inside the shape (this covers if the line is completely enclosed by the shape)
    if (this.outlineContains(polygon.outline, u, tolerance)) {
      return true
    }

    // check for intersections for all of the sides
    for (let i = 0; i < length; i ++) {
      const j = (i + 1) % length
      // Originally https://github.com/davidfig/intersects/blob/9fba4c88dcf28998ced7df7c6e744646eac1917d/line-line.js#L23
      if (geom.getLineSegsIntersection(u, v, points[i], points[j]) !== null) {
        return true
      }
    }
    return false
  }

  /**
   * @param {Geom.VectJson} u 
   * @param {Geom.VectJson} v 
   * @param {Geom.Poly} polygon
   */
  lineSegCrossesPolygon(u, v, { outline, holes }) {
    if (this.lineSegCrossesRing(u, v, outline)) return true;
    return holes.some(hole => this.lineSegCrossesRing(u, v, hole));
  }

  /**
   * @param {Geom.VectJson} u 
   * @param {Geom.VectJson} v 
   * @param {Geom.VectJson[]} ring
   */
  lineSegCrossesRing(u, v, ring) {
    if (ring.length === 0) return false;
    let u1 = ring[ring.length - 1];
    for (const v1 of ring) {
      if (this.getLineSegsIntersection(u, v, u1, v1) !== null) {
        return true;
      }
      u1 = v1;
    }
    return false;
  }

  /**
   * https://stackoverflow.com/a/1079478/2917822
   * https://github.com/davidfig/intersects/blob/master/line-circle.js
   * @param {Geom.VectJson} a 
   * @param {Geom.VectJson} b 
   * @param {Geom.VectJson} center 
   * @param {number} radius 
   */
  lineSegIntersectsCircle(a, b, center, radius) {
    const ab = tempVect.copy(b).sub(a);
    const ac = tempVect2.copy(center).sub(a);
    const ab2 = ab.dot(ab); // |ab|^2
    const acab = ac.dot(ab);
    let t = acab / ab2;
    t = (t < 0) ? 0 : t;
    t = (t > 1) ? 1 : t;
    const h = tempVect2.set((ab.x * t + a.x) - center.x, (ab.y * t + a.y) - center.y);
    return h.dot(h) <= radius * radius;
  }

  /**
   * https://github.com/davidfig/intersects/blob/master/line-point.js
   * @param {Geom.Vect} u 
   * @param {Geom.Vect} v 
   * @param {Geom.Vect} p 
   * @param {number} [tolerance] Default 1
   * @returns 
   */
  lineSegIntersectsPoint(u, v, p, tolerance = 1) {
    tolerance = tolerance || 1
    return Math.abs(
      u.distanceToSquared(v) - (u.distanceToSquared(p) + v.distanceToSquared(p))
    ) <= tolerance;
  }

  /**
   * Get segment through center along 'x+'.
   * @param {Geom.AngledRect<Geom.Rect>} _ 
   */
  getAngledRectSeg({ angle, baseRect }) {
    const widthNormal = tempVect.set(Math.cos(angle), Math.sin(angle));
    const heightNormal = tempVect2.set(-Math.sin(angle), Math.cos(angle));
    const src = baseRect.topLeft.addScaledVector(heightNormal, 0.5 * baseRect.height);
    return [src, src.clone().addScaledVector(widthNormal, baseRect.width)];
  }

  /**
   * Find point closest to @see {p} on line segment @see {a} -> @see {b}
   * Source: https://github.com/martywallace/polyk/blob/90757dbd3d358f68c3a1a54e50710548a435ee7a/index.js#L450
   * @param {Geom.VectJson} p 
   * @param {Geom.VectJson} a 
   * @param {Geom.VectJson} b 
   * @returns {Geom.VectJson & { dst: number }}
   */
  getClosestOnLineSeg(p, a, b) {
    const x = p.x
    const y = p.y
    const x1 = a.x
    const y1 = a.y
    const x2 = b.x
    const y2 = b.y
  
    const A = x - x1
    const B = y - y1
    const C = x2 - x1
    const D = y2 - y1
  
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    const param = dot / lenSq

    /** @type {number} */
    let xx;
    /** @type {number} */
    let yy;
  
    if (param < 0 || (x1 === x2 && y1 === y2)) {
      xx = x1
      yy = y1
    } else if (param > 1) {
      xx = x2
      yy = y2
    } else {
      xx = x1 + param * C
      yy = y1 + param * D
    }
  
    const dx = x - xx
    const dy = y - yy
    const dst = Math.sqrt(dx * dx + dy * dy)

    return { dst, x: xx, y: yy };
  }

  /**
   * Source: https://github.com/martywallace/polyk/blob/90757dbd3d358f68c3a1a54e50710548a435ee7a/index.js#L390
   * @param {Geom.VectJson} point
   * @param {Geom.VectJson[]} outline
   * @returns {Geom.ClosestOnOutlineResult}
   */
  getClosestOnOutline(point, outline) {
    const p = outline;
    const { x, y } = point;
    const a1 = tempVect;
    const b1 = tempVect2;
    const b2 = tempVect3;
    // var c = tp[4] // is assigned a value but never used.
    
    a1.set(x, y);
    let isc = {dist: 0, edgeId: 0, point: {x: 0, y: 0}, norm: {x: 0, y: 0}};
    isc.dist = Infinity;

    for (var i = 0; i < p.length; i++) {
      b1.copy(p[i]);
      b2.copy(p[(i + 1) % p.length]);
      const result = this.getClosestOnLineSeg(a1, b1, b2);
      if (result.dst < isc.dist) {
        isc.dist = result.dst;
        isc.edgeId = i;
        isc.point.x = result.x;
        isc.point.y = result.y;
      }
    }

    const idst = 1 / isc.dist;
    isc.norm.x = (x - isc.point.x) * idst;
    isc.norm.y = (y - isc.point.y) * idst;
    return isc;
  }

  /**
   * Compute intersection of two infinite lines i.e.
   * 1. `lambda x. p0 + x * d0`.
   * 2. `lambda x. p1 + x * d1`.
   *
   * If they intersect non-degenerately,
   * return parameter solving (1) else `null`.
   *
   * @param {Geom.VectJson} p0 Point on first line
   * @param {Geom.VectJson} d0 Unit direction of first line
   * @param {Geom.VectJson} p1 Point on second line
   * @param {Geom.VectJson} d1 Unit direction of second line
   * @returns {number | null}
   */
  getLinesIntersect(p0, d0, p1, d1) {
    /**
     * Recall normal_0 is (-d0.y, d0.x).
     * No intersection if directions d0, d1 approx. parallel, ignoring colinear.
     */
    if (Math.abs(-d0.y * d1.x + d0.x * d1.y) < 0.0001) {
      return null;
    }
    return (d1.x * (p1.y - p0.y) - d1.y * (p1.x - p0.x)) / (d0.y * d1.x - d1.y * d0.x);
  }
  /**
   * Returns parameters solving each line and actual point (if solution exists).
   * @param {Geom.VectJson} p0 Point on first line
   * @param {Geom.VectJson} d0 Unit direction of first line
   * @param {Geom.VectJson} p1 Point on second line
   * @param {Geom.VectJson} d1 Unit direction of second line
   * @returns {{ lambda1: number; lambda2: number; point: Geom.VectJson } | null}
   */
  getLinesIntersectInfo(p0, d0, p1, d1) {
    const lambda1 = this.getLinesIntersect(p0, d0, p1, d1);
    if (lambda1 !== null) {
      const point = Vect.from(p0).addScaledVector(d0, lambda1);
      const offset = point.clone().sub(p1)
      const lambda2 = offset.dot(d1) >= 0 ? offset.length : -offset.length;
      return { lambda1, point, lambda2 };
    } else {
      return null;
    }
  }

  /**
   * Get intersection between line `p + λ.d` and line segment `[q0, q1]`.
   * Returns `λ` or null if no intersection.
   * @param {Geom.Vect} p 
   * @param {Geom.Vect} d 
   * @param {Geom.Vect} q0 
   * @param {Geom.Vect} q1 
   */
  getLineLineSegIntersect(p, d, q0, q1) {
    // normal n = (-dy,dx)
    let dx = d.x, dy = d.y, px = p.x, py = p.y,
        // dot products (q0 - p).n and (q1 -p).n
        k1 = (q0.x - px)*-dy + (q0.y - py)*dx, 
        k2 = (q1.x - px)*-dy + (q1.y - py)*dx,
        dqx, dqy, z, s0, s1;
    
    // (q0 - p).n and (q1 - p).n are both zero
    // iff both q0 and q1 lie along the line p + lambda * d
    if (k1 === 0 && k2 === 0) {
        // return signed distance to closer point
        s0 = (q0.x - px)*dx + (q0.y - py)*dy;
        s1 = (q1.x - px)*dx + (q1.y - py)*dy;
        return (Math.abs(s0) < Math.abs(s1)) ? s0 : s1;
    }
    // if (q0 - p).n and (q1 - p).n have different signs
    // (where at most one of them is zero)
    // then they must intersect the line p --d-->
    else if (k1 * k2 <= 0) {
        dqx = q1.x - q0.x;
        dqy = q1.y - q0.y;
        // compute z-component of cross product d \times (q1 - q0)
        z = dx * dqy - dy * dqx;
        // z shouldn't equal 0 since then p,q0,q1 colinear and k1 = k2 = 0
        // but we check anyway (?)
        if(z === 0) return null;
        // otherwise have formula for signed distance
        // coming from two simultaneous equations for line vs line intersection
        return (py*dqx + px*-dqy + (q0.x * q1.y - q0.y * q1.x)) / z;
    }
    return null;
  }

  /**
   * Compute intersection of 2 line segments:
   * - p0 -- p1
   * - q0 -- q1
   *
   * If they intersect, return `lambda` in [0, 1] s.t. intersection is
   * `p0 + (p1 - p0) * lambda`, else return `null`.
   * @param {Geom.VectJson} p0
   * @param {Geom.VectJson} p1
   * @param {Geom.VectJson} q0
   * @param {Geom.VectJson} q1
   */
  getLineSegsIntersection(p0, p1, q0, q1) {
    let dpx = p1.x - p0.x,
        dpy = p1.y - p0.y,
        dqx = q1.x - q0.x,
        dqy = q1.y - q0.y,
        /** @type {number} */ s,
        /** @type {number} */ t,
        /** The z component of cross product `dp x dq` */
        z = -dqx * dpy + dpx * dqy;
  
    if (z === 0){
      /**
       * Line segs are parallel, so both have non-normalized
       * normal (-dpy, dpx). For colinearity they must have
       * the same dot product w.r.t latter.
       */
      if ((p0.x * -dpy + p0.y * dpx) === (q0.x * -dpy + q0.y * dpx)){
        /**
         * Check if p0 or p1 lies between both q0 and q1.
         */
        t = dqx * dqx + dqy * dqy;
        s = (p0.x - q0.x) * dqx + (p0.y - q0.y) * dqy;
        if (0 <= s && s <= t) {
          return s / t;
        }
        s = (p1.x - q0.x) * dqx + (p1.y - q0.y) * dqy;
        if (0 <= s && s <= t) {
          return s / t;
        }
      }
      return null;
    } else {
      s = (-dpy * (p0.x - q0.x) + dpx * (p0.y - q0.y)) / z;
      t = (dqx  * (p0.y - q0.y) - dqy * (p0.x - q0.x)) / z;
      if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        return t;
      }
    }
    return null;
  }

  /**
   * @param {Geom.Direction} direction : ;
   * @param {0 | 1 | 2 | 3} delta 
   * @returns {Geom.Direction}
   */
  getDeltaDirection(direction, delta) {
    return /** @type {Geom.Direction} */ ((direction + delta) % 4);
  }
  
  /**
   * @param {Geom.Direction} direction : ;
   * @param {'x' | 'y'} axis 
   * @returns {Geom.Direction}
   */
  getFlippedDirection(direction, axis) {
    if (axis === 'x') {// Flip n/s i.e. 0/2
      return direction % 2 === 0
        ? /** @type {Geom.Direction} */ (2 - direction)
        : direction;
    } else {// Flip e/w i.e. 1/3
      return direction % 2 === 1
        ? /** @type {Geom.Direction} */ (4 - direction)
        : direction;
    }
  }

  /**
   * Join disjoint triangulations
   * @param {Geom.Triangulation[]} triangulations 
   * @returns {Geom.Triangulation}
   */
  joinTriangulations(triangulations) {
    if (triangulations.length === 1) return triangulations[0];
    /** @type {Vect[]} */
    const vs = [];
    /** @type {[number, number, number][]} */
    const tris =  [];
    let offset = 0;
    for (const decomp of triangulations) {
      vs.push(...decomp.vs);
      tris.push(...decomp.tris.map(tri => /** @type {[number, number, number]} */ (tri.map(x => x += offset))));
      offset += decomp.vs.length;
    }
    return { vs, tris };
  }

  /**
   * Compute light polygon.
   * @param {LightPolyDef} def
   */
  lightPolygon({ position: pos, direction, range, tris, exterior, extraSegs = [] }) {
    const lightBounds = new Rect(pos.x - range, pos.y - range, 2 * range, 2 * range);

    if (direction) {
      const d = direction.clone().normalize();
      extraSegs.push([
        pos.clone().addScaledVector(d, -2).translate(-d.y * range * 2, d.x * range * 2),
        pos.clone().addScaledVector(d, -2).translate(-1 * -d.y * range * 2, -1 * d.x * range * 2),
      ]);
    }

    const closeTris = tris??[].filter(({ rect }) => lightBounds.intersects(rect));
    const points = new Set(
      closeTris.reduce((agg, { outline }) => agg.concat(outline), /** @type {Geom.Vect[]} */ ([]))
        .concat(exterior?.allPoints??[]),
    );
    const allLineSegs = closeTris.reduce(
      (agg, { outline: [u, v, w] }) => agg.concat([[u, v], [v, w], [w, u]]),
      /** @type {[Geom.Vect, Geom.Vect][]} */ ([]),
    ).concat(
      exterior?.lineSegs??[],
      extraSegs,
    );

    // These will be unit directional vectors.
    const dir0 = Vect.zero;
    const dir1 =  Vect.zero;
    const dir2 =  Vect.zero;
    // These will be minimal distances to intersections.
    /** @type {number} */ let dist0;
    /** @type {number} */ let dist1;
    /** @type {number} */ let dist2;
    /** @type {number | null} */ let d = null;
    
    /** Intersections relative to {pos}. @type {Vect[]} */
    const deltas = [];

    for (const point of points) {
      // Project 3 rays from `pos`
      dir1.copy(point).sub(pos).normalize();
      dir0.copy(dir1).rotate(-0.001);
      dir2.copy(dir1).rotate(+0.001);
      dist0 = dist1 = dist2 = range;
      // Detect how far each ray propagates without hitting a line segment
      allLineSegs.forEach(([q0, q1]) => {
        d = this.getLineLineSegIntersect(pos, dir0, q0, q1);
        if (d !== null && d >= 0 && d < dist0) {
          dist0 = d;
        }
        d = this.getLineLineSegIntersect(pos, dir1, q0, q1);
        if (d !== null && d >= 0 && d < dist1) {
          dist1 = d;
        }
        d = this.getLineLineSegIntersect(pos, dir2, q0, q1);
        if (d !== null && d >= 0 && d < dist2) {
          dist2 = d;
        }
      });
      // Append to unsorted light polygon
      deltas.push(
        dir0.clone().scale(dist0),
        dir1.clone().scale(dist1),
        dir2.clone().scale(dist2),
      );
    }

    deltas.sort((p, q) =>
      this.radRange(Math.atan2(q.y, q.x)) - this.radRange(Math.atan2(p.y, p.x))
    );

    return new Poly(deltas.map((p) => p.add(pos)));
  }

  /**
   * https://github.com/davidfig/intersects/blob/master/polygon-point.js
   * polygon-point collision
   * based on https://stackoverflow.com/a/17490923/1955997
   * @param {Geom.VectJson[]} outline
   * @param {Geom.VectJson} p point
   * @param {number | null} [tolerance]
   * - Maximum distance of point to polygon's edges that triggers collision (see pointLine).
   * - We can ignore edges by setting `tolerance` as `null`.
   */
  outlineContains(outline, p, tolerance = 0.1) {
    const length = outline.length
    let c = false
    let i, j
    for (i = 0, j = length - 1; i < length; i++) {
      if (
        (outline[i].y > p.y) !== (outline[j].y > p.y)
        &&
        (p.x < (outline[j].x - outline[i].x) * (p.y - outline[i].y) / (outline[j].y - outline[i].y) + outline[i].x)
      ) {
        c = !c
      }
      j = i
    }
    if (c) {
      return true
    }
    if (typeof tolerance === 'number') {// Check edges too
      for (i = 0; i < length; i++) {
        tempVect.copy(i === length - 1 ? outline[0] : outline[i + 1])
        if (geom.lineSegIntersectsPoint(tempVect3.copy(outline[i]), tempVect, tempVect2.copy(p), tolerance)) {
          return true
        }
      }
    }
    return false
  }

  /**
   * @param {Poly[]} polygons 
   * @returns {Geom.Triangulation}
   */
  polysToTriangulation(polygons) {
    const decomps = polygons.map(p => p.qualityTriangulate());
    return this.joinTriangulations(decomps);
  }

  /**
   * Convert a polygonal rectangle back into a `Rect` and `angle`.
   * We ensure the width is greater than or equal to the height.
   * @param {Geom.Poly} poly
   * @returns {Geom.AngledRect<Geom.Rect>}
   */
  polyToAngledRect(poly) {
    const ps = poly.outline;
    const w = tempVect.copy(ps[1]).sub(ps[0]).length;
    const h = tempVect2.copy(ps[2]).sub(ps[1]).length;

    if (w >= h) {
      return {
        baseRect: new Rect(ps[0].x, ps[0].y, w, h),
        angle: Math.atan2(tempVect.y, tempVect.x),
      };
    } else {
      return {
        baseRect: new Rect(ps[1].x, ps[1].y, h, w),
        angle: Math.atan2(tempVect2.y, tempVect2.x),
      };
    }
  }

  /**
   * Force radian to range [0, 2pi).
   * @param {number} radian
   */
  radRange(radian) {
    radian %= (2 * Math.PI);
    // if (Math.abs(x) <= 0.001) x = 0;
    return radian >= 0 ? radian : (2 * Math.PI + radian);
  }

  /**
   * @param {Geom.Rect} rect 
   * @param {Geom.VectJson[]} points 
   */
  rectIntersectsConvexPoly(rect, points) {
    return this.convexPolysIntersect(
      rect.points,
      points,
    );
  }

  /**
   * @template {Geom.VectJson} T
   * @param {T[]} path
   * @returns {T[]}
   */
  removePathReps(path) {
    let prev = path[0];
    return prev
      ? path.reduce((agg, p) => {
          if (!((p.x === prev.x) && (p.y === prev.y))) {
            agg.push(prev = p);
          }
          return agg;
        }, /** @type {typeof path} */ ([prev]))
      : path;
  }

/**
 * Based on https://github.com/Phrogz/svg-path-to-polygons/blob/master/svg-path-to-polygons.js.
 * - Only supports straight lines i.e. M, L, H, V, Z.
 * - Expects a __single polygon__ with ≥ 0 holes.
 * @param {string} svgPathString
 * @returns {null | Geom.Poly}
 */
  svgPathToPolygon(svgPathString) {
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
   * @param {Geom.Triangulation} decomp 
   * @returns {Geom.Poly[]}
   */
  triangulationToPolys(decomp) {
    return decomp.tris.map(([u, v, w]) =>
      new Poly([decomp.vs[u], decomp.vs[v], decomp.vs[w]])
    );
  }
}

const tempVect = new Vect;
const tempVect2 = new Vect;
const tempVect3 = new Vect;

export const geom = new geomServiceClass;

/**
 * Aligned to `Geom.Direction`.
 */
export const directionChars = /** @type {const} */ (['n', 'e', 's', 'w']);
 
/**
 * @typedef LightPolyDef @type {object}
 * @property {Geom.Vect} position Position of light.
 * @property {Geom.Vect} [direction] Direction of light.
 * @property {number} range 
 * @property {Geom.Poly[]} [tris] Triangles defining obstructions
 * @property {Geom.Poly} [exterior] Simple polygon (i.e. ring) we are inside
 * @property {[Geom.Vect, Geom.Vect][]} [extraSegs] Line segs
 */
