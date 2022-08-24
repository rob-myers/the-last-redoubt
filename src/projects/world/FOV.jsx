import React from "react";
import { css, cx } from "@emotion/css";
import { Poly } from "../geom";
import { geomorphPngPath } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";

// TODO
// - ✅ given (gmId, roomId) changed, compute doorId, otherRoomId etc.
//   and store inside roomTransition
// - ✅ fix open door while original room door closed by remembering doorId
// - ✅ fix new bug i.e. sometimes frontier wrong on first traversal
// - fix hull doors

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
      const gm = gms[state.gmId];
      const openDoorsIds = props.api.doors.getOpen(state.gmId);

      const { prev } = state;
      /** @type {CoreState} */
      const curr = { gmId: state.gmId, roomId: state.roomId, doorId: state.doorId, openDoorsIds };
      const comp = compareCoreState(prev, curr);
      if (!comp.changed) {// Avoid useless updates, also to compute 'frontier polygons'
        return;
      }

      if (comp.changedRoom) {
        const hullDoorId = gm.getHullDoorId(curr.doorId);
        const otherDoorId = hullDoorId >= 0 ? (gmGraph.getAdjacentRoomCtxt(curr.gmId, hullDoorId)?.adjDoorId)??-1 : -1;

        state.roomTs = {
          srcGmId: prev.gmId, srcRoomId: prev.roomId,
          dstGmId: curr.gmId, dstRoomId: curr.roomId,
          srcDoorId: hullDoorId >= 0 ? otherDoorId : curr.doorId,
          dstDoorId: curr.doorId,
        };
      }

      /**
       * Light polygons for current geomorph and possibly adjacent ones
       * We also include the current room.
       */
      const lightPolys = gmGraph
        .computeLightPolygons(state.gmId, state.roomId, openDoorsIds)
        .concat({ gmId: state.gmId, poly: gm.roomsWithDoors[state.roomId] }
      );
      const groupedLightPolys = gms.map((_, gmId) =>
        lightPolys.filter(x => x.gmId === gmId).map(x => x.poly.precision(2))
      );

      /** Compute mask polygons by cutting light from hullPolygon */
      const maskPolys = groupedLightPolys.map((polys, altGmId) =>
        Poly.cutOutSafely(polys, [gms[altGmId].hullOutline])
      );

      // TODO support hull doors
      if (comp.firstUpdate) {
        state.shade = gms.map(_ => []);
      } else if (comp.changedRoom) {
        const shadingLight = gmGraph.computeShadingLight(state.roomTs, openDoorsIds);
        state.shade[state.gmId] = Poly.cutOutSafely([shadingLight.poly], groupedLightPolys[state.gmId]);
      } else if (comp.openedDoor && state.roomTs.srcGmId !== -1) {
        const shadingLight = gmGraph.computeShadingLight(state.roomTs, openDoorsIds);
        state.shade[state.gmId] = Poly.cutOutSafely([shadingLight.poly], groupedLightPolys[state.gmId]);
      }

      // Try to eliminate "small black no-light intersections" from current geomorph,
      // which often look triangular. As part of mask they have no holes.
      // However, polygons sans holes also arise e.g. when light borders a hull door.
      maskPolys[state.gmId] = maskPolys[state.gmId].filter(x =>
        x.holes.length > 0 || x.outline.length > 8
      );

      state.clipPath = gmMaskPolysToClipPaths(maskPolys, gms);
      state.shadeClipPath = gmMaskPolysToClipPaths(state.shade, gms, 'inset(100000px)');
      state.prev = curr;
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
          key={`${gmId}-shade`}
          className="geomorph-dark geomorph-shade"
          src={geomorphPngPath(gm.key)}
          draggable={false}
          width={gm.pngRect.width}
          height={gm.pngRect.height}
          style={{
            opacity: 0.2,
            clipPath: state.shadeClipPath[gmId],
            WebkitClipPath: state.shadeClipPath[gmId],
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
 * @param {CoreState} prev
 * @param {CoreState} next
 */
function compareCoreState(prev, next) {
  const changedRoom = prev.gmId !== next.gmId || prev.roomId !== next.roomId;
  const openedDoor = next.openDoorsIds.length > prev.openDoorsIds.length;
  const closedDoor = next.openDoorsIds.length < prev.openDoorsIds.length;
  return {
    changedRoom,
    openedDoor,
    closedDoor,
    changed: changedRoom || openedDoor || closedDoor,
    firstUpdate: prev.gmId === -1,
  };
}
