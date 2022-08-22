import React from "react";
import { css, cx } from "@emotion/css";
import { Poly } from "../geom";
import { geomorphPngPath } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";

/**
 * IN PROGRESS: Additional light shade
 * - currently the light frontier
 * - try other approaches
 */

/**
 * Field Of View, implemented via dark parts of geomorphs
 * @param {Props} props 
 */
export default function FOV(props) {

  const { gmGraph, gmGraph: { gms } } = props.api;

  const state = useStateRef(/** @type {() => State} */ () => ({
    gmId: 0,
    roomId: 9,
    // gmId: 0, roomId: 2,
    // gmId: 0, roomId: 15, // ISSUE
    // gmId: 1, roomId: 5,
    // gmId: 1, roomId: 22,
    // gmId: 2, roomId: 2,
    // gmId: 3, roomId: 26,

    clipPath: gms.map(_ => 'none'),
    frontierClipPath: gms.map(_ => 'none'), 
    prev: {
      light: gms.map(_ => []),
      frontier: gms.map(_ => []),
      hash: [-1, -1],
    },
    ready: true,

    setRoom(gmId, roomId) {
      if (state.gmId !== gmId || state.roomId !== roomId) {
        state.gmId = gmId;
        state.roomId = roomId;
        props.api.updateAll();
        return true;
      } else {
        return false;
      }
    },
    updateClipPath() {
      const gm = gms[state.gmId];
      const openDoorsIds = props.api.doors.getOpen(state.gmId);

      // Avoid useless updates, also to compute frontierPolys
      const stateHash = getLightHash(state, openDoorsIds);
      const changedRoom = (
        `${stateHash.slice(0, 2)}` !== `${state.prev.hash.slice(0, 2)}`
        && state.prev.hash[0] !== -1
      );
      if (`${stateHash}` === `${state.prev.hash}`) {
        return;
      }
      
      /**
       * Light polygons for current geomorph and possibly adjacent ones
       * We also include the current room.
       */
      const lightPolys = gmGraph.computeLightPolygons(state.gmId, state.roomId, openDoorsIds)
        .concat({ gmIndex: state.gmId, poly: gm.roomsWithDoors[state.roomId] }
      );

      const frontierPolys = state.prev.frontier;

      /** Compute mask polygons by cutting light from hullPolygon */
      const maskPolys = gms.map((otherGm, altGmId) => {
        const polys = lightPolys.filter(x => x.gmIndex === altGmId).map(x => x.poly.precision(2));
        if (changedRoom) {
          frontierPolys[altGmId] = Poly.cutOutSafely(state.prev.light[altGmId], polys);
        }
        state.prev.frontier[altGmId] = frontierPolys[altGmId];
        state.prev.light[altGmId] = polys;

        return Poly.cutOutSafely(polys, [otherGm.hullOutline]);
      });

      // Try to eliminate "small black no-light intersections" from current geomorph,
      // which often look triangular. As part of mask they have no holes.
      // However, polygons sans holes also arise e.g. when light borders a hull door.
      maskPolys[state.gmId] = maskPolys[state.gmId].filter(x =>
        x.holes.length > 0 || x.outline.length > 8
      );

      state.clipPath = gmMaskPolysToClipPaths(maskPolys, gms);
      state.frontierClipPath = gmMaskPolysToClipPaths(frontierPolys, gms, 'inset(100000px)');
      state.prev.hash = stateHash;
    },
  }), {
    overwrite: { gmId: true, roomId: true },
    deps: [gms, gmGraph, props.api],
  });

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <div className={cx("FOV", rootCss)}>
      {gms.map((gm, gmId) => [
        <img
          key={gmId}
          className="geomorph-dark"
          src={geomorphPngPath(gm.key)}
          draggable={false}
          width={gm.pngRect.width}
          height={gm.pngRect.height}
          style={{
            clipPath: state.clipPath[gmId],
            WebkitClipPath: state.clipPath[gmId],
            left: gm.pngRect.x,
            top: gm.pngRect.y,
            transform: gm.transformStyle,
            transformOrigin: gm.transformOrigin,
          }}
        />,
        <img
          key={`${gmId}-frontier`}
          className="geomorph-dark geomorph-frontier"
          src={geomorphPngPath(gm.key)}
          draggable={false}
          width={gm.pngRect.width}
          height={gm.pngRect.height}
          style={{
            opacity: 0.2,
            clipPath: state.frontierClipPath[gmId],
            WebkitClipPath: state.frontierClipPath[gmId],
            left: gm.pngRect.x,
            top: gm.pngRect.y,
            transform: gm.transformStyle,
            transformOrigin: gm.transformOrigin,
          }}
        />,
        ]
      )}
    </div>
  );
}

/**
 * @typedef Props @type {object}
 * @property {import('../world/World').State} api
 * @property {(fovApi: State) => void} onLoad
 */

/**
 * @typedef State @type {object}
 * @property {number} gmId
 * @property {boolean} ready
 * @property {number} roomId
 * @property {string[]} clipPath
 * @property {string[]} frontierClipPath
 * @property {{ light: Poly[][]; frontier: Poly[][]; hash: number[] }} prev
 * @property {(gmId: number, roomId: number) => boolean} setRoom
 * @property {() => void} updateClipPath
 */

 const rootCss = css`
  img.geomorph-dark {
    position: absolute;
    transform-origin: top left;
    pointer-events: none;
    filter: invert(100%) brightness(34%);
    /* filter: invert(100%) brightness(75%) contrast(200%) brightness(50%); */
  }
`;

/**
 * Convert geomorph masks into a CSS format.
 * @param {Poly[][]} maskPolys 
 * @param {Geomorph.GeomorphDataInstance[]} gms 
 */
function gmMaskPolysToClipPaths(maskPolys, gms, defaultClipPath = 'none') {
  return maskPolys.map((maskPoly, gmId) => {
    // <img> top-left needn't be at world origin
    const polys = maskPoly.map(poly => poly.clone().translate(-gms[gmId].pngRect.x, -gms[gmId].pngRect.y));
    const svgPaths = polys.map(poly => `${poly.svgPath}`).join(' ');
    return svgPaths.length ? `path('${svgPaths}')` : defaultClipPath;
  });
}

/**
 * @param {State} state 
 * @param {number[]} openDoorsIds 
 */
function getLightHash(state, openDoorsIds) {
  return [state.gmId, state.roomId, ...openDoorsIds];
}
