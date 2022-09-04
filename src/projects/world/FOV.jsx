import React from "react";
import { css, cx } from "@emotion/css";
import { Poly } from "../geom";
import { geomorphPngPath } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";

/**
 * TODO 🚧 migrate light shade into geomorph PNG render
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
    doorId: -1,
    // gmId: 0, roomId: 2,
    // gmId: 0, roomId: 15, // ISSUE
    // gmId: 1, roomId: 5,
    // gmId: 1, roomId: 22,
    // gmId: 2, roomId: 2,
    // gmId: 3, roomId: 26,

    clipPath: gms.map(_ => 'none'),
    prev: { gmId: -1, roomId: -1, doorId: -1, openDoorsIds: [] },
    ready: true,
    roomTs: { srcGmId: -1, srcRoomId: -1, srcDoorId: -1, dstGmId: -1, dstRoomId: -1, dstDoorId: -1 },
    shade: gms.map(_ => []),
    shadeClipPath: gms.map(_ => 'none'), 

    setRoom(gmId, roomId, doorId) {
      if (state.gmId !== gmId || state.roomId !== roomId) {
        state.gmId = gmId;
        state.roomId = roomId;
        state.doorId = doorId;
        props.api.updateAll();
        return true;
      } else {
        return false;
      }
    },
    updateClipPath() {
      const { prev } = state;
      const gm = gms[state.gmId];
      const openDoorsIds = props.api.doors.getOpen(state.gmId);

      /** @type {CoreState} */
      const curr = { gmId: state.gmId, roomId: state.roomId, doorId: state.doorId, openDoorsIds };
      const cmp = compareCoreState(prev, curr);
      if (!cmp.changed) {
        return; // Avoid useless updates, also to compute 'frontier' for light shade
      }

      /**
       * Light polygons for current geomorph and possibly adjacent ones
       * We also add the current room.
       */
      const lightPolys = gmGraph.computeLightPolygons(state.gmId, state.roomId);
      lightPolys[state.gmId].push(gm.roomsWithDoors[state.roomId]);

      /** Compute mask polygons by cutting light from hullPolygon */
      const maskPolys = lightPolys.map((polys, altGmId) =>
        Poly.cutOutSafely(polys, [gms[altGmId].hullOutline])
      );
      // Try to eliminate "small black no-light intersections" from current geomorph,
      // which often look triangular. As part of mask they have no holes.
      // However, polygons sans holes also arise e.g. when light borders a hull door.
      maskPolys[state.gmId] = maskPolys[state.gmId].filter(x =>
        x.holes.length > 0 || x.outline.length > 8
      );

      state.clipPath = gmMaskPolysToClipPaths(maskPolys, gms);
      state.prev = curr;

      // /**
      //  * Compute light shade
      //  */
      // if (cmp.justSpawned || cmp.changedRoom) {
      //   const hullDoorId = gm.getHullDoorId(curr.doorId);
      //   const otherDoorId = hullDoorId >= 0 ? (gmGraph.getAdjacentRoomCtxt(curr.gmId, hullDoorId)?.adjDoorId)??-1 : -1;

      //   state.roomTs = {
      //     srcGmId: prev.gmId, srcRoomId: prev.roomId,
      //     dstGmId: curr.gmId, dstRoomId: curr.roomId,
      //     srcDoorId: hullDoorId >= 0 ? otherDoorId : curr.doorId,
      //     dstDoorId: curr.doorId,
      //   };
      // }
      // /** Have we ever left current room (post spawn)? */
      // const neverLeftRoom = state.roomTs.srcGmId === -1;

      // if (cmp.justSpawned || neverLeftRoom) {
      //   state.shade = gms.map(_ => []);
      // } else if (cmp.changedRoom || cmp.openedIds) {
      //   // TODO track roomIds in light.adjData, ignoring open door
      //   // when they don't contribute any new roomIds

      //   // Project a single global light polygon
      //   const light = gmGraph.computeShadingLight(state.roomTs);
      //   // Create shading by cutting localised version from each lightPolys[gmId] 
      //   state.shade = gms.map((gm, gmId) => lightPolys[gmId].length > 0
      //     ? Poly.cutOutSafely([light.poly.clone().applyMatrix(gm.inverseMatrix)], [Poly.fromRect(gm.hullRect)])
      //     : [] // Shades everything
      //   );
      // }

      // state.shadeClipPath = gmMaskPolysToClipPaths(state.shade, gms, 'inset(100000px)');
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
        // <img
        //   key={`${gmId}-shade`}
        //   className="geomorph-dark geomorph-shade"
        //   src={geomorphPngPath(gm.key)}
        //   draggable={false}
        //   width={gm.pngRect.width}
        //   height={gm.pngRect.height}
        //   style={{
        //     opacity: 0.2,
        //     // filter: 'sepia(0.5) hue-rotate(90deg)',
        //     clipPath: state.shadeClipPath[gmId],
        //     WebkitClipPath: state.shadeClipPath[gmId],
        //     left: gm.pngRect.x,
        //     top: gm.pngRect.y,
        //     transform: gm.transformStyle,
        //     transformOrigin: gm.transformOrigin,
        //   }}
        // />,
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

/** @typedef State @type {Omit<CoreState, 'openDoorsIds'> & AuxState} */

/**
 * @typedef AuxState @type {object}
 * @property {boolean} ready
 * @property {string[]} clipPath
 * @property {Poly[][]} shade
 * @property {string[]} shadeClipPath
 * @property {CoreState} prev Previous state, last time we updated clip path
 * @property {Graph.BaseNavGmTransition} roomTs Last room transition
 * @property {(gmId: number, roomId: number, doorId: number) => boolean} setRoom
 * @property {() => void} updateClipPath
 */

/**
 * @typedef CoreState @type {object}
 * @property {number} gmId Current geomorph id
 * @property {number} roomId Current room id (relative to geomorph)
 * @property {number} doorId Last traversed door id (relative to geomorph)
 * @property {number[]} openDoorsIds
 */

 const rootCss = css`
  img.geomorph-dark {
    position: absolute;
    transform-origin: top left;
    pointer-events: none;
    /* filter: invert(100%) brightness(34%); */
    filter: invert(100%) brightness(75%) contrast(200%) brightness(50%);
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
 * @param {CoreState} prev
 * @param {CoreState} next
 */
function compareCoreState(prev, next) {
  const justSpawned = prev.gmId === -1;
  const changedRoom = !justSpawned && ((prev.gmId !== next.gmId) || (prev.roomId !== next.roomId));
  
  // Currently only track whether doors opened/closed in Player's current geomorph
  const openedDoorIds = justSpawned || (prev.gmId === next.gmId)
    ? next.openDoorsIds.filter(x => !prev.openDoorsIds.includes(x)) : [];
  const closedDoorIds = justSpawned || (prev.gmId === next.gmId)
    ? prev.openDoorsIds.filter(x => !next.openDoorsIds.includes(x)) : [];

  return {
    justSpawned,
    changedRoom,
    openedIds: openedDoorIds.length ? openedDoorIds : null,
    closedIds: closedDoorIds.length ? closedDoorIds : null,
    changed: justSpawned || changedRoom || openedDoorIds.length || closedDoorIds.length,
  };
}
