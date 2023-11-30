import React from "react";
import { RenderTexture } from "@pixi/core";
import { Graphics } from "@pixi/graphics";

import { Poly, Vect } from "../geom";
import { geomorphMapFilterHidden, geomorphMapFilterShown, gmScale } from "../world/const";
import { assertNonNull, testNever } from "../service/generic";
import { getGmRoomKey, labelMeta } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";
import GmSprites from "./GmSprites";
import { colMatFilter3, tempMatrix1 } from "./Misc";

/**
 * Field Of View, implemented by covering dark parts.
 * 
 * Initially all rooms are dark.
 * `state.setRoom` must be invoked to make some room visible,
 * e.g. via `spawn {npcName} $( click 1 )`.
 *
 * @param {Props} props 
 */
export default function FOV(props) {

  const { api } = props;
  const { gmGraph, gmGraph: { gms } } = api;

  const state = useStateRef(/** @type {() => State} */ () => ({
    //#region core state
    gmId: -1,
    roomId: -1,
    lastDoorId: -1,
    prev: { gmId: -1, roomId: -1, lastDoorId: -1 },
    //#endregion

    rootedOpenIds: gms.map(_ => []),
    gmRoomIds: [],

    ready: true,
    gfx: new Graphics(),
    tex: gms.map(gm => RenderTexture.create({
      width: gmScale * gm.pngRect.width,
      height: gmScale * gm.pngRect.height,
    })),
    maskPolys: gms.map(_ => []),

    // 🚧 remove below
    el: /** @type {State['el']} */ ({ canvas: /** @type {HTMLCanvasElement[]} */ ([]) }),
    anim: { labels: new Animation, map: new Animation },

    drawLabels() {
      for (const [gmId, canvas] of state.el.canvas.entries()) {
        const ctxt = assertNonNull(canvas.getContext('2d'));
        const gm = gms[gmId];
        const scale = gmScale;
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
          // label background
          ctxt.fillStyle = '#00004422';
          ctxt.fillRect(-4, -4, rect.width + 8, rect.height + 8);
          ctxt.fillStyle = '#fff';
          // label
          ctxt.fillText(text, 0, 0);
          ctxt.translate(-topLeft.x, -topLeft.y);
        }
      }
    },
    forgetPrev() {
      state.prev = { gmId: -1, roomId: -1, lastDoorId: -1 };
    },
    mapAct(action, timeMs) {
      switch (action) {
        case 'show':
        case 'show-labels':
          state.anim.labels = state.el.labels.animate(
            [{ opacity: 1 }],
            { fill: 'forwards', duration: timeMs ?? 1500 },
          );
          action === 'show' && (state.anim.map = state.el.map.animate(
            [{ filter: geomorphMapFilterShown }],
            { fill: 'forwards', duration: timeMs ?? 750 },
          ));
          break;
        case 'hide':
        case 'hide-labels':
          state.anim.labels = state.el.labels.animate(
            [{ opacity: 0 }],
            { fill: 'forwards', duration: timeMs ?? 1500 },
          );
          action === 'hide' && (state.anim.map = state.el.map.animate(
            [{ filter: geomorphMapFilterHidden }],
            { fill: 'forwards', duration: timeMs ?? 750 },
          ));
          break;
        case 'show-labels-for':
        case 'show-for': {
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
          action === 'show-for' && (state.anim.map = state.el.map.animate(
            [
              { filter: geomorphMapFilterShown, offset: 500 / durationMs },
              { filter: geomorphMapFilterShown, offset: (500 + timeMs) / durationMs },
              { filter: geomorphMapFilterHidden, offset: 1 },
            ],
            { fill: 'forwards', duration: durationMs },
          ));
          break;
        }
        case 'pause':
          state.anim.labels.playState === 'running' && state.anim.labels.pause();
          state.anim.map.playState === 'running' && state.anim.map.pause();
          break;
        case 'resume':
          state.anim.labels.playState === 'paused' && state.anim.labels.play();
          state.anim.map.playState === 'paused' && state.anim.map.play();
          break;
        case undefined:
          return getComputedStyle(state.el.labels).opacity;
        default:
          throw testNever(action, {
            override: `mapAct: ${action} must be in ${JSON.stringify(api.lib.fovMapActionKeys)} or undefined`,
          });
      }
    },
    recompute() {
      if (state.gmId === -1) {
        return; // state.gmId is -1 <=> state.roomId is -1
      }
      
      /** @type {CoreState} */
      const curr = { gmId: state.gmId, roomId: state.roomId, lastDoorId: state.lastDoorId };
      const cmp = compareState(api, curr);
      if (!cmp.changed) {// Avoid useless updates
        return;
      }

      /**
       * @see {viewPolys} view polygons for current/adjacent geomorphs; we include the current room.
       * @see {gmRoomIds} global room ids of every room intersecting fov
       */
      const viewPolys = gmGraph.computeViews(state.gmId, state.roomId);
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
      state.maskPolys = viewPolys.map((polys, altGmId) =>
        (polys.length ? Poly.cutOutSafely(polys, [gms[altGmId].hullOutline]) : [])
          // exclude poly between adj-hull-doors
          // 🤔 must be large enough to show small rooms
          .filter(x => x.rect.area > 30 * 30)
      );

      state.prev = curr;
      state.rootedOpenIds = cmp.rootedOpenIds;

      // Track visible rooms (assuming gmRoomIds has no dups)
      const nextGmRoomIds = gmRoomIds.map(x => ({ ...x, key: getGmRoomKey(x.gmId, x.roomId)}));
      const removed = state.gmRoomIds.filter(x => !nextGmRoomIds.some(y => y.key === x.key));
      const added = nextGmRoomIds.filter(x => !state.gmRoomIds.some(y => y.key === x.key));
      state.gmRoomIds = nextGmRoomIds;
      api.npcs.events.next({ key: 'fov-changed', gmRoomIds: nextGmRoomIds, added, removed });

      // api.setShownGms(state.gmRoomIds.reduce(
      //   (agg, { gmId }) => { !agg.includes(gmId) && agg.push(gmId); return agg; },
      //   /** @type {number[]} */ ([]),
      // ));

      state.render();
    },
    render() {
      const gfx = state.gfx;
      gms.forEach((gm, gmId) => {
        const polys = state.maskPolys[gmId];
        gfx.clear();
        if (polys.length) {
          gfx.setTransform(-gmScale * gm.pngRect.x, -gmScale * gm.pngRect.y, gmScale, gmScale);
          polys.forEach(poly => {
            gfx.beginTextureFill({ texture: api.geomorphs.unlit[gmId], matrix: tempMatrix1.set(1/gmScale, 0, 0, 1/gmScale, gm.pngRect.x, gm.pngRect.y) });
            gfx.drawPolygon(poly.outline);
            poly.holes.forEach(hole => {
              gfx.beginHole();
              gfx.drawPolygon(hole);
              gfx.endHole();
            })
            gfx.endFill();
          });
        } else {
          gfx.setTransform().beginTextureFill({ texture: api.geomorphs.unlit[gmId] });
          gfx.drawRect(0, 0, gm.pngRect.width * gmScale, gm.pngRect.height * gmScale);
          gfx.endFill();
        }
        api.renderInto(gfx, state.tex[gmId], true);
      });
    },
    setRoom(gmId, roomId, doorId) {
      if (state.gmId !== gmId || state.roomId !== roomId || state.lastDoorId === -1) {
        [state.gmId, state.roomId, state.lastDoorId] = [gmId, roomId, doorId];
        state.recompute();
        api.debug.updateDebugRoom();
        return true;
      } else {
        return false;
      }
    },
    setRoomByNpc(npcKey) {
      const npc = api.npcs.getNpc(npcKey);
      const position = npc.getPosition();
      const found = (// Fallback includes doors, picking some connected roomId
        api.gmGraph.findRoomContaining(position, false)
        || api.gmGraph.findRoomContaining(position, true)
      );
      if (found) {
        props.api.fov.setRoom(found.gmId, found.roomId, -1);
        return found;
      } else {
        console.error(`setRoomByNpc: ${npcKey}: no room/door contains ${JSON.stringify(position)}`)
        return null;
      }
    },
  }), {
    overwrite: { gmId: true, roomId: true },
    deps: [gms, gmGraph],
  });

  React.useEffect(() => {
    props.onLoad(state);
    // state.drawLabels();
  }, []);

  return (
    <GmSprites
      gms={gms}
      tex={state.tex}
      filters={[colMatFilter3]}
    />
  );
}

/**
 * @typedef Props @type {object}
 * @property {import('./WorldPixi').State} api
 * @property {(fovApi: State) => void} onLoad
 */

/** @typedef State @type {CoreState & AuxState} */

/**
 * @typedef AuxState @type {object}
 * @property {(Geomorph.GmRoomId & { key: string })[]} gmRoomIds
 * @property {{ map: Animation; labels: Animation; }} anim
 * @property {CoreState} prev Previous state, last time we updated clip path
 * @property {boolean} ready
 * @property {import('pixi.js').Graphics} gfx
 * @property {import('pixi.js').RenderTexture[]} tex
 * @property {Geom.Poly[][]} maskPolys
 * 
 * @property {{ map: HTMLDivElement; labels: HTMLDivElement; canvas: HTMLCanvasElement[] }} el Labels need their own canvas because geomorphs are e.g. reflected
 * @property {() => void} drawLabels
 * @property {(action?: NPC.FovMapAction, showMs?: number) => void} mapAct
 * @property {number[][]} rootedOpenIds
 * `rootedOpenIds[gmId]` are the open door ids in `gmId` reachable from the FOV "root room".
 * They are induced by `state.gmId`, `state.roomId` and also the currently open doors.
 * @property {() => void} forgetPrev
 * @property {() => void} render
 * @property {(gmId: number, roomId: number, doorId: number) => boolean} setRoom
 * @property {(npcKey: string) => Geomorph.GmRoomId | null} setRoomByNpc
 * @property {() => void} recompute
*/

/**
 * @typedef CoreState @type {object}
 * @property {number} gmId Current geomorph id
 * @property {number} roomId Current room id (relative to geomorph)
 * @property {number} lastDoorId Last traversed doorId in geomorph `gmId`
 */

// const geomorphMapFilterShown = 'invert(100%) brightness(30%) contrast(120%)';
// const geomorphMapFilterHidden = 'invert(100%) brightness(0%) contrast(120%)';


/**
 * @param {import('./WorldPixi').State} api
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
