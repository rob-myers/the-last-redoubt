import React from "react";
import { css, cx } from "@emotion/css";
import { Poly } from "../geom";
import { cssName } from "../service/const";
import { geomorphPngPath, getGmRoomKey } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * Field Of View, implemented via dark parts of geomorphs
 * @param {Props} props 
 */
export default function FOV(props) {

  const { gmGraph, gmGraph: { gms } } = props.api;

  const update = useUpdate();

  const state = useStateRef(/** @type {() => State} */ () => ({
    /**
     * Initially all rooms are dark.
     * @see {state.setRoom} must be invoked to make some room visible,
     * e.g. via `spawn npc`.
     */
    gmId: -1,
    roomId: -1,
    doorId: -1,
    // gmId: 0, roomId: 2,
    // gmId: 0, roomId: 15,
    // gmId: 1, roomId: 5,
    // gmId: 1, roomId: 22,
    // gmId: 2, roomId: 2,
    // gmId: 3, roomId: 26,

    clipPath: gms.map(_ => 'none'),
    gmRoomIds: [],
    prev: { gmId: -1, roomId: -1, doorId: -1, openDoorsIds: [] },
    ready: true,
    rootEl: /** @type {HTMLDivElement} */ ({}),

    getImgEl(gmId) {
      return /** @type {HTMLImageElement} */ (state.rootEl.children[gmId]);
    },
    onLoadGmImage(e) {
      const imgEl = /** @type {HTMLImageElement} */ (e.target);
      props.api.npcs.events.next({
        key: 'unlit-geomorph-loaded',
        gmKey: /** @type {Geomorph.LayoutKey} */ (imgEl.dataset.gmKey),
        gmId: Number(imgEl.dataset.gmId),
      });
    },
    setRoom(gmId, roomId, doorId) {
      if (state.gmId !== gmId || state.roomId !== roomId || state.doorId === -1) {
        state.gmId = gmId;
        state.roomId = roomId;
        state.doorId = doorId;
        state.updateClipPath();
        props.api.doors.updateVisibleDoors();
        props.api.debug.update();
        return true;
      } else {
        return false;
      }
    },
    updateClipPath() {
      if (state.gmId === -1) {
        return;
      }
      
      const { prev } = state;
      const openDoorsIds = props.api.doors.getOpen(state.gmId);

      /** @type {CoreState} */
      const curr = { gmId: state.gmId, roomId: state.roomId, doorId: state.doorId, openDoorsIds };
      const cmp = compareCoreState(prev, curr);
      if (!cmp.changed) {// Avoid useless updates
        return;
      }

      /**
       * @see {viewPolys} view polygons for current/adjacent geomorphs; we include the current room.
       * @see {gmRoomIds} global room ids of every room intersecting fov
       */
      const { polys: viewPolys, gmRoomIds } = gmGraph.computeViewPolygons(state.gmId, state.roomId);

      // Must prevent adjacent geomorphs from covering hull doors
      const adjGmToPolys = computeAdjHullDoorPolys(state.gmId, gmGraph);
      Object.entries(adjGmToPolys).forEach(([gmStr, polys]) =>
        viewPolys[Number(gmStr)] = Poly.union(viewPolys[Number(gmStr)].concat(polys))
      );

      /** Compute mask polygons by cutting light from hullPolygon */
      const maskPolys = viewPolys.map((polys, altGmId) =>
        Poly.cutOutSafely(polys, [gms[altGmId].hullOutline])
      );
      /**
       * Try to eliminate "small black no-light intersections" from current geomorph.
       * They often look triangular, and as part of mask they have no holes.
       * However, polygons sans holes also arise e.g. when light borders a hull door.
       * @see {gmGraph.computeViewPolygons} for new approach
       */
      // maskPolys[state.gmId] = maskPolys[state.gmId].filter(x =>
      //   x.holes.length > 0 || (x.outline.length > 8)
      // );

      state.clipPath = gmMaskPolysToClipPaths(maskPolys, gms);
      state.prev = curr;

      // Track visible rooms
      const nextGmRoomIds = gmRoomIds.map(x => ({ ...x, key: getGmRoomKey(x.gmId, x.roomId)}));
      const removed = state.gmRoomIds.filter(x => !nextGmRoomIds.some(y => y.key === x.key));
      const added = nextGmRoomIds.filter(x => !state.gmRoomIds.some(y => y.key === x.key));
      props.api.npcs.events.next({ key: 'fov-changed', gmRoomIds: nextGmRoomIds, added, removed });
      state.gmRoomIds = nextGmRoomIds;

      update();
    },
  }), {
    overwrite: { gmId: true, roomId: true },
    deps: [gms, gmGraph],
  });

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <div
      className={cx("fov", rootCss)}
      onLoad={state.onLoadGmImage}
      ref={el => el && (state.rootEl = el)}
    >
      {gms.map((gm, gmId) =>
        <img
          key={gmId}
          className="geomorph-dark"
          src={geomorphPngPath(gm.key)}
          data-gm-key={gm.key}
          data-gm-id={gmId}
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
 * @property {string[]} clipPath
 * @property {(Graph.GmRoomId & { key: string })[]} gmRoomIds
 * @property {CoreState} prev Previous state, last time we updated clip path
 * @property {(gmId: number) => HTMLImageElement} getImgEl
 * @property {(e: React.SyntheticEvent<HTMLElement>) => void} onLoadGmImage
 * @property {boolean} ready
 * @property {HTMLDivElement} rootEl
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
    * Fix Chrome over-clipping
    * 👁 Desktop: unmax Tabs: keep walking
    * ℹ️ happened on put <FOV> after <Doors>
    */
  will-change: transform;

  /**
   * - invert(100%) brightness(34%)
   * - invert(100%) brightness(32%) contrast(150%)
   */
  ${cssName.geomorphDarkFilter}: invert(100%) brightness(36%) contrast(150%);

  
  img.geomorph-dark {
    position: absolute;
    transform-origin: top left;
    pointer-events: none;
    filter: var(${cssName.geomorphDarkFilter});
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

/**
 * adj geomorph id to hullDoor polys we should remove
 * @param {number} gmId 
 * @param {Graph.GmGraph} gmGraph 
 */
function computeAdjHullDoorPolys(gmId, gmGraph) {
  const adjGmToPolys = /** @type {Record<number, Poly[]>} */ ({});
  for (const localNode of gmGraph.getSuccs(gmGraph.nodesArray[gmId])) {
    const adjNode = gmGraph.getAdjacentDoor(localNode);
    if (adjNode) {
      const otherHullDoor = gmGraph.gms[adjNode.gmId].hullDoors[adjNode.hullDoorId];
      (adjGmToPolys[adjNode.gmId] ||= []).push(otherHullDoor.poly);
    }
  }
  return adjGmToPolys;
}
