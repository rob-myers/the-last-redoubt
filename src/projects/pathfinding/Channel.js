import { Utils } from './Utils';
import { Vect } from '../geom';

/** @typedef {{ left: Geom.VectJson; right: Geom.VectJson }} Portal */

export class Channel {
  // 🚧 generic node type?

  /**
   * Aligned to edges of `this.nodePath` i.e. the nav node ids along edge.
   * We compute this whilst pulling the string.
   * @type {number[][]}
   */
  nodePartition;

  /** @param {Graph.FloorGraphNode[]} nodePath */
  constructor (nodePath) {
    /** @type {Portal[]} */
    this.portals = [];
    /** @type {typeof nodePath} */
    this.nodePath = nodePath;
    this.nodePartition = [];
  }

  /**
   * @param {Geom.VectJson} p1 
   * @param {Geom.VectJson} [p2]
   */
  push (p1, p2) {
    if (p2 === undefined) p2 = p1;
    this.portals.push({
      left: p1,
      right: p2
    });
  }

  stringPull () {
    const portals = this.portals;
    /** @type {Geom.VectJson[]} */
    const pts = [];
    // Init scan state
    /** @type {Geom.VectJson} */ let portalApex;
    /** @type {Geom.VectJson} */ let portalLeft;
    /** @type {Geom.VectJson} */ let portalRight;
    let apexIndex = 0, leftIndex = 0, rightIndex = 0;

    // these are all `src`
    portalApex = portals[0].left;
    portalLeft = portals[0].left;
    portalRight = portals[0].right;

    
    pts.push(portalApex); // Add `src`

    /**
     * The navPath indexes whose points will appear in string-pulled path (possibly sans final).
     * We'll use this to construct @see {nodePartition}.
     */
    const subPathIds = /** @type {number[]} */ ([0]);

    for (let i = 1; i < portals.length; i++) {
      const left = portals[i].left;
      const right = portals[i].right;

      // Update right vertex.
      if (Utils.triarea2(portalApex, portalRight, right) <= 0.0) {
        if (Utils.vequal(portalApex, portalRight) || Utils.triarea2(portalApex, portalLeft, right) > 0.0) {
          // Tighten the funnel.
          portalRight = right;
          rightIndex = i;
        } else {
          // Right over left, insert left to path and restart scan from portal left point.
          pts.push(portalLeft);
          subPathIds.push(leftIndex - 1);

          // Make current left the new apex.
          portalApex = portalLeft;
          apexIndex = leftIndex;
          // Reset portal
          portalLeft = portalApex;
          portalRight = portalApex;
          leftIndex = apexIndex;
          rightIndex = apexIndex;
          // Restart scan
          i = apexIndex;
          continue;
        }
      }

      // Update left vertex.
      if (Utils.triarea2(portalApex, portalLeft, left) >= 0.0) {
        if (Utils.vequal(portalApex, portalLeft) || Utils.triarea2(portalApex, portalRight, left) < 0.0) {
          // Tighten the funnel.
          portalLeft = left;
          leftIndex = i;
        } else {
          // Left over right, insert right to path and restart scan from portal right point.
          pts.push(portalRight);
          subPathIds.push(rightIndex - 1);
          // Make current right the new apex.
          portalApex = portalRight;
          apexIndex = rightIndex;
          // Reset portal
          portalLeft = portalApex;
          portalRight = portalApex;
          leftIndex = apexIndex;
          rightIndex = apexIndex;
          // Restart scan
          i = apexIndex;
          continue;
        }
      }
    }

    if ((pts.length === 0) || (!Utils.vequal(pts[pts.length - 1], portals[portals.length - 1].left))) {
      pts.push(portals[portals.length - 1].left); // Append `dst` to path
    }

    this.nodePartition = subPathIds.map((pathId, i) =>
      this.nodePath.slice(pathId, subPathIds[i + 1]).map(x => x.index)
    );

    this.path = pts;
    return pts;
  }
}
