import React from "react";
import { css, cx } from "@emotion/css";
import { Poly } from "../geom";
import { geomorphPngPath } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";

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
    gmRoomIds: [],
    prev: { gmId: -1, roomId: -1, doorId: -1, openDoorsIds: [] },
    ready: true,

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
      if (!cmp.changed) {// Avoid useless updates
        return;
      }

      // ✅ provide every { gmId, roomId } intersecting current fov
      // 🚧 track change in above

      /**
       * @see {lightPolys} light polygons for current/adjacent geomorphs; we include the current room.
       * @see {gmRoomIds} global room ids of every room intersecting fov
       */
      const { polys: lightPolys, gmRoomIds } = gmGraph.computeLightPolygons(state.gmId, state.roomId);
      lightPolys[state.gmId].push(gm.roomsWithDoors[state.roomId]);
      gmRoomIds.length === 0 && gmRoomIds.push({ gmId: state.gmId, roomId: state.roomId });

      /** Compute mask polygons by cutting light from hullPolygon */
      const maskPolys = lightPolys.map((polys, altGmId) =>
        Poly.cutOutSafely(polys, [gms[altGmId].hullOutline])
      );
      /**
       * Try to eliminate "small black no-light intersections" from current geomorph.
       * They often look triangular, and as part of mask they have no holes.
       * However, polygons sans holes also arise e.g. when light borders a hull door.
       */
      maskPolys[state.gmId] = maskPolys[state.gmId].filter(x =>
        x.holes.length > 0 || x.outline.length > 8
      );

      state.clipPath = gmMaskPolysToClipPaths(maskPolys, gms);
      state.prev = curr;

      // Track visible rooms
      const nextGmRoomIds = gmRoomIds.map(x => ({ ...x, key: `g${x.gmId}r${x.roomId}` }));
      const removed = state.gmRoomIds.filter(x => !nextGmRoomIds.some(y => y.key === x.key));
      const added = nextGmRoomIds.filter(x => !state.gmRoomIds.some(y => y.key === x.key));
      props.api.npcs.events.next({ key: 'fov-changed', gmRoomIds: nextGmRoomIds, added, removed });
      state.gmRoomIds = nextGmRoomIds;
    },
  }), {
    overwrite: { gmId: true, roomId: true },
    deps: [gms, gmGraph],
  });

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <div className={cx("fov", rootCss)}>
      {gms.map((gm, gmId) =>
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
            // Avoid initial flicker on <Geomorphs> load first
            background: 'white',
          }}
        />
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
 * @property {(Graph.GmRoomId & { key: string })[]} gmRoomIds
 * @property {CoreState} prev Previous state, last time we updated clip path
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
  /**
    * Fix Chrome over-clipping,
    * 👁 Desktop: unmax Tabs: keep walking
    */
  will-change: transform;

  img.geomorph-dark {
    position: absolute;
    transform-origin: top left;
    pointer-events: none;
    /* filter: invert(100%) brightness(34%); */
    filter: invert(100%) brightness(30%) contrast(150%);
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
