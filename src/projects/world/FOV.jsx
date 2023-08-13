import React from "react";
import { css, cx } from "@emotion/css";
import { Poly, Vect } from "../geom";
import { defaultClipPath, geomorphMapFilterHidden, geomorphMapFilterShown } from "./const";
import { assertNonNull, testNever } from "../service/generic";
import { geomorphPngPath, getGmRoomKey, labelMeta } from "../service/geomorph";
import { npcService } from "../service/npc";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * Field Of View, implemented via dark parts of geomorphs
 * @param {Props} props 
 */
export default function FOV(props) {

  const { api } = props;
  const { gmGraph, gmGraph: { gms } } = api;

  const update = useUpdate();

  const state = useStateRef(/** @type {() => State} */ () => ({
    /**
     * Initially all rooms are dark.
     * @see {state.setRoom} must be invoked to make some room visible,
     * e.g. via `spawn {npcName} $( click 1 )`.
     */

    //#region core state
    gmId: -1,
    roomId: -1,
    lastDoorId: -1,
    nearDoorIds: new Set,

    prev: { gmId: -1, roomId: -1, lastDoorId: -1, nearDoorIds: new Set },
    //#endregion

    rootedOpenIds: gms.map(_ => []),
    gmRoomIds: [],

    ready: true,
    el: /** @type {State['el']} */ ({ canvas: /** @type {HTMLCanvasElement[]} */ ([]) }),
    anim: { labels: new Animation, map: new Animation },
    clipPath: gms.map(_ => 'none'),

    computeNearDoorIds(gmRoomId) {
      const player = api.npcs.getPlayer();
      if (player) {
        state.nearDoorIds.clear();
        /**
         * On npc enter doorway, `npc.gmRoomId` doesn't change,
         * whereas Player's FOV does i.e. `api.fov.{gmId,roomId}`.
         * Then `gmRoomId` permits us to override `player.gmRoomId`.
         */
        gmRoomId ??= (player.gmRoomId ?? undefined);
        gmRoomId && api.decor.getDecorAtPoint(
          player.getPosition(), gmRoomId.gmId, gmRoomId.roomId,
        ).forEach(decor =>
          decor.meta.doorSensor
          && api.fov.nearDoorIds.add(/** @type {number} */ (decor.meta.doorId))
        );
      }
    },
    drawLabels() {
      for (const [gmId, canvas] of state.el.canvas.entries()) {
        const ctxt = assertNonNull(canvas.getContext('2d'));
        const gm = gms[gmId];
        const scale = 2;
        ctxt.setTransform(1, 0, 0, 1, 0, 0);
        ctxt.clearRect(0, 0, canvas.width, canvas.height);
        ctxt.setTransform(scale, 0, 0, scale, -scale * gm.pngRect.x, -scale * gm.pngRect.y);
        ctxt.transform(gm.inverseMatrix.a, gm.inverseMatrix.b, gm.inverseMatrix.c, gm.inverseMatrix.d, 0, 0);
        ctxt.font = labelMeta.font;
        ctxt.textBaseline = 'top';
        ctxt.fillStyle = '#fff';
        const topLeft = new Vect();
        for (const { text, rect } of gm.labels) {
          // Compute transform of rect center then translate to top-left
          gm.matrix.transformSansTranslate(
            topLeft.set(rect.x + (rect.width/2), rect.y + (rect.height/2))
          ).translate(-rect.width/2, -rect.height/2);
          ctxt.translate(topLeft.x, topLeft.y);
          ctxt.fillText(text, 0, 0);
          ctxt.translate(-topLeft.x, -topLeft.y);
        }
      }
    },
    forgetPrev() {
      state.prev = { gmId: -1, roomId: -1, lastDoorId: -1, nearDoorIds: new Set };
    },
    hideUnseen() {
      const rootEl = api.getRootEl();
      const visGmId = state.gmRoomIds.reduce((agg, { gmId }) => { agg[gmId] = true; return agg; }, /** @type {Record<number, true>} */ ({}))
      gms.forEach((_, gmId) => visGmId[gmId]
        ? rootEl.classList.add(`show-gm-${gmId}`)
        : rootEl.classList.remove(`show-gm-${gmId}`)
      );
    },
    mapAct(action, timeMs) {// ℹ️ hopefully the browser cleans stale animations
      if (action === 'show') {
        state.anim.labels = state.el.labels.animate(
          [{ opacity: 1 }],
          { fill: 'forwards', duration: timeMs ?? 1500 },
        );
        state.anim.map = state.el.map.animate(
          [{ filter: geomorphMapFilterShown }],
          { fill: 'forwards', duration: timeMs ?? 750 },
        );
      } else if (action === 'hide') {
        state.anim.labels = state.el.labels.animate(
          [{ opacity: 0 }],
          { fill: 'forwards', duration: timeMs ?? 1500 },
        );
        state.anim.map = state.el.map.animate(
          [{ filter: geomorphMapFilterHidden }],
          { fill: 'forwards', duration: timeMs ?? 750 },
        );
      } else if (action === 'show-for-ms') {
        timeMs ??= 1000;
        const durationMs = 500 + timeMs + 500; // ½ sec fade in/out
        state.anim.labels = state.el.labels.animate(
          [
            { opacity: 1, offset: 500 / durationMs },
            { opacity: 1, offset: (500 + timeMs) / durationMs },
            { opacity: 0, offset: 1 },
          ],
          { fill: 'forwards', duration: durationMs },
        );
        state.anim.map = state.el.map.animate(
          [
            { filter: geomorphMapFilterShown, offset: 500 / durationMs },
            { filter: geomorphMapFilterShown, offset: (500 + timeMs) / durationMs },
            { filter: geomorphMapFilterHidden, offset: 1 },
          ],
          { fill: 'forwards', duration: durationMs },
        );
      } else if (action === undefined) {
        return getComputedStyle(state.el.labels).opacity;
      } else if (action === 'pause') {
        state.anim.labels.playState === 'running' && state.anim.labels.pause();
        state.anim.map.playState === 'running' && state.anim.map.pause();
      } else if (action === 'resume') {
        state.anim.labels.playState === 'paused' && state.anim.labels.play();
        state.anim.map.playState === 'paused' && state.anim.map.play();
      } else {
        throw testNever(action, {
          override: `mapAct: ${action} must be in ${JSON.stringify(npcService.fovMapActionKeys)} or undefined`,
        });
      }
    },
    recompute() {
      if (state.gmId === -1) {
        return; // state.gmId is -1 <=> state.roomId is -1
      }
      
      /** @type {CoreState} */
      const curr = { gmId: state.gmId, roomId: state.roomId, lastDoorId: state.lastDoorId, nearDoorIds: new Set(state.nearDoorIds) };
      const cmp = compareState(api, curr);
      if (!cmp.changed) {// Avoid useless updates
        return;
      }

      /**
       * @see {viewPolys} view polygons for current/adjacent geomorphs; we include the current room.
       * @see {gmRoomIds} global room ids of every room intersecting fov
       */
      const viewPolys = gmGraph.computeViews(state.gmId, state.roomId, Array.from(state.nearDoorIds));
      const gmRoomIds = gmGraph.getGmRoomsIdsFromDoorIds(cmp.rootedOpenIds);
      // If no door is open, we at least have current room
      gmRoomIds.length === 0 && gmRoomIds.push({ gmId: state.gmId, roomId: state.roomId });

      // Must prevent adjacent geomorphs from covering hull doors (if adjacent room visible)
      const visRoomIds = gmRoomIds.flatMap(({ gmId, roomId }) => state.gmId === gmId ? roomId : []);
      const adjGmToPolys = computeAdjHullDoorPolys(state.gmId, visRoomIds, gmGraph);
      Object.entries(adjGmToPolys).forEach(([gmStr, polys]) =>
        viewPolys[Number(gmStr)] = Poly.union(viewPolys[Number(gmStr)].concat(polys))
      );

      /** Compute mask polygons by cutting light from hullPolygon */
      const maskPolys = viewPolys.map((polys, altGmId) =>
        polys.length ? Poly.cutOutSafely(polys, [gms[altGmId].hullOutline]) : []
      );
      /**
       * Try to eliminate "small black no-light intersections" from current geomorph.
       * They often look triangular, and as part of mask they have no holes.
       * However, polygons sans holes also arise e.g. when light borders a hull door.
       * @see {gmGraph.computeViews} for new approach
       */
      // maskPolys[state.gmId] = maskPolys[state.gmId].filter(x =>
      //   x.holes.length > 0 || (x.outline.length > 8)
      // );

      state.clipPath = gmMaskPolysToClipPaths(maskPolys, gms);
      state.prev = curr;
      state.rootedOpenIds = cmp.rootedOpenIds;

      // Track visible rooms
      // 🤔 we assume gmRoomIds has no dups
      const nextGmRoomIds = gmRoomIds.map(x => ({ ...x, key: getGmRoomKey(x.gmId, x.roomId)}));
      const removed = state.gmRoomIds.filter(x => !nextGmRoomIds.some(y => y.key === x.key));
      const added = nextGmRoomIds.filter(x => !state.gmRoomIds.some(y => y.key === x.key));
      state.gmRoomIds = nextGmRoomIds;
      api.npcs.events.next({ key: 'fov-changed', gmRoomIds: nextGmRoomIds, added, removed });

      state.hideUnseen();
      update();
    },
    setRoom(gmId, roomId, doorId) {
      if (state.gmId !== gmId || state.roomId !== roomId || state.lastDoorId === -1) {
        state.gmId = gmId;
        state.roomId = roomId;
        state.lastDoorId = doorId;
        state.computeNearDoorIds({ gmId, roomId });

        state.recompute();
        api.doors.updateVisibleDoors();
        api.debug.update();
        if (doorId === -1) {
          /**
           * Light may come through a door from another room,
           * due to the way we handle diagonal doors.
           */
          api.geomorphs.recomputeLights(gmId, roomId);
        }
        return true;
      } else {
        return false;
      }
    },
  }), {
    overwrite: { gmId: true, roomId: true },
    deps: [gms, gmGraph],
  });

  React.useEffect(() => {
    props.onLoad(state);
    state.drawLabels();
  }, []);

  return (
    <div
      className={cx("fov", rootCss)}
      ref={el => el && (
        [state.el.map, state.el.labels] = /** @type {HTMLDivElement[]} */ (Array.from(el.children))
      )}
    >
      <div className="map">
        {gms.map((gm, gmId) =>
          <div
            key={gmId}
            style={{ transform: gm.transformStyle }}
          >
            <img
              className="geomorph-dark"
              src={geomorphPngPath(gm.key, 'map')}
              draggable={false}
              width={gm.pngRect.width}
              height={gm.pngRect.height}
              style={{
                clipPath: state.clipPath[gmId],
                WebkitClipPath: state.clipPath[gmId],
                left: gm.pngRect.x,
                top: gm.pngRect.y,
                // Avoid initial flicker on <Geomorphs> load first
                background: 'white',
              }}
            />
          </div>
        )}
      </div>

      <div className="labels">
        {gms.map((gm, gmId) =>
          <div
            key={gmId}
            style={{ transform: gm.transformStyle }}
          >
            <canvas
              ref={(el) => el && (state.el.canvas[gmId] = el)}
              width={gm.pngRect.width * 2}
              height={gm.pngRect.height * 2}
              style={{
                left: gm.pngRect.x,
                top: gm.pngRect.y,
                transform: `scale(0.5) translate(-${gm.pngRect.width}px, -${gm.pngRect.height}px)`,
              }}
            />
          </div>
        )}
      </div>

    </div>
  );
}

/**
 * @typedef Props @type {object}
 * @property {import('../world/World').State} api
 * @property {(fovApi: State) => void} onLoad
 */

/** @typedef State @type {CoreState & AuxState} */

/**
 * @typedef AuxState @type {object}
 * @property {string[]} clipPath
 * @property {(Geomorph.GmRoomId & { key: string })[]} gmRoomIds
 * @property {{ map: Animation; labels: Animation; }} anim
 * @property {CoreState} prev Previous state, last time we updated clip path
 * @property {boolean} ready
 * @property {{ map: HTMLDivElement; labels: HTMLDivElement; canvas: HTMLCanvasElement[] }} el Labels need their own canvas because geomorphs are e.g. reflected
 * @property {() => void} drawLabels
 * @property {() => void} hideUnseen
 * @property {(action?: NPC.FovMapAction, showMs?: number) => void} mapAct
 * @property {number[][]} rootedOpenIds
 * `rootedOpenIds[gmId]` are the open door ids in `gmId` reachable from the FOV "root room".
 * They are induced by `state.gmId`, `state.roomId` and also the currently open doors.
 * @property {() => void} forgetPrev
 * @property {(gmRoomId?: Geomorph.GmRoomId) => void} computeNearDoorIds
 * Calculate `state.nearDoorIds` initially or upon exit room (enter doorway).
 *
 * Importantly, when an NPC enters a doorway `npc.gmRoomId` doesn't change,
 * but the Player's FOV _does_ (`api.fov.{gmId,roomId}`).
 * Then the parameter `gmRoomId` permits us to override `player.gmRoomId`.
 * @property {(gmId: number, roomId: number, doorId: number) => boolean} setRoom
 * @property {() => void} recompute
*/

/**
 * @typedef CoreState @type {object}
 * @property {number} gmId Current geomorph id
 * @property {number} roomId Current room id (relative to geomorph)
 * @property {number} lastDoorId Last traversed doorId in geomorph `gmId`
 * @property {Set<number>} nearDoorIds
 * Doors of "current" room the Player is near to.
 *
 * ℹ️ On walk into doorways this is the "next room",
 * unlike `player.gmRoomId` which will be the previous room.
 */

// const geomorphMapFilterShown = 'invert(100%) brightness(30%) contrast(120%)';
// const geomorphMapFilterHidden = 'invert(100%) brightness(0%) contrast(120%)';

 const rootCss = css`
  /**
    * Fix Chrome over-clipping
    * 👁 Desktop: unmax Tabs: keep walking
    * ℹ️ happened on put <FOV> after <Doors>
    */
  will-change: transform;

  > .map {
    filter: ${geomorphMapFilterShown};
  }
  > .labels {
    opacity: 1;
  }
  
  img.geomorph-dark {
    position: absolute;
    transform-origin: top left;
    pointer-events: none;
  }
  canvas {
    position: absolute;
    pointer-events: none;
  }
`;

/**
 * Convert geomorph masks into a CSS format.
 * @param {Poly[][]} maskPolys 
 * @param {Geomorph.GeomorphDataInstance[]} gms 
 */
function gmMaskPolysToClipPaths(maskPolys, gms) {
  return maskPolys.map((maskPoly, gmId) => {
    // <img> top-left needn't be at world origin
    const polys = maskPoly.map(poly => poly.clone().translate(-gms[gmId].pngRect.x, -gms[gmId].pngRect.y));
    const svgPaths = polys.map(poly => `${poly.svgPath}`).join(' ');
    return maskPoly.length && svgPaths.length ? `path('${svgPaths}')` : defaultClipPath;
  });
}

/**
 * @param {import('./World').State} api
 * @param {CoreState} next
 */
function compareState(api, next) {
  const { prev, rootedOpenIds } = api.fov;
  const nextRootedOpenIds = api.gmGraph.getViewDoorIds(next.gmId, next.roomId).map(x => Array.from(x));

  const justSpawned = prev.gmId === -1;
  const changedRoom = !justSpawned && !(prev.gmId === next.gmId && prev.roomId === next.roomId);
  
  const rootedOpenedIds = nextRootedOpenIds.map((doorIds, gmId) =>
    doorIds.filter(doorId => !rootedOpenIds[gmId].includes(doorId))
  );
  const rootedClosedIds = rootedOpenIds.map((doorIds, gmId) =>
    doorIds.filter(doorId => !nextRootedOpenIds[gmId].includes(doorId))
  );

  // Technically, nearDoorIds need to be open to have an effect
  const [prevNearIds, nextNearIds] = [prev.nearDoorIds, next.nearDoorIds].map(x => Array.from(x));
  const addedNearIds = changedRoom ? nextNearIds : nextNearIds.filter(doorId => !prevNearIds.includes(doorId));
  const removedNearIds = changedRoom ? prevNearIds : prevNearIds.filter(doorId => !nextNearIds.includes(doorId));

  return {
    justSpawned,
    changedRoom,
    rootedOpenIds: nextRootedOpenIds,
    rootedOpenedIds,
    rootedClosedIds,
    changed: (
      justSpawned
      || changedRoom
      || rootedOpenedIds.some(x => x.length)
      || rootedClosedIds.some(x => x.length)
      || (addedNearIds.length || removedNearIds.length)
    ),
  };
}

/**
 * adj geomorph id to hullDoor polys we should remove
 * @param {number} gmId 
 * @param {number[]} visRoomIds 
 * @param {Graph.GmGraph} gmGraph 
 */
function computeAdjHullDoorPolys(gmId, visRoomIds, gmGraph) {
  const adjGmToPolys = /** @type {Record<number, Poly[]>} */ ({});
  const hullDoorNodes = gmGraph.doorNodeByGmId[gmId];
  for (const hullDoorNode of hullDoorNodes) {
    const adjHullDoorNode = gmGraph.getAdjacentDoor(hullDoorNode);
    if (adjHullDoorNode) {
      const hullDoor = gmGraph.gms[gmId].hullDoors[hullDoorNode.hullDoorId];
      const otherHullDoor = gmGraph.gms[adjHullDoorNode.gmId].hullDoors[adjHullDoorNode.hullDoorId];
      // only add if adjacent room is visible
      if (hullDoor.roomIds.some(roomId => roomId !== null && visRoomIds.includes(roomId))) {
        (adjGmToPolys[adjHullDoorNode.gmId] ||= []).push(otherHullDoor.poly);
      }
    }
  }
  return adjGmToPolys;
}
