import React from "react";
import { BLEND_MODES, RenderTexture, Matrix } from "@pixi/core";
import { Graphics } from "@pixi/graphics";

import { removeDups, removeFirst, testNever } from "../service/generic";
import { addToDecorGrid, decorContainsPoint, ensureDecorMetaGmRoomId, getDecorRect, isCollidable, isDecorPoint, normalizeDecor, queryDecorGridInterects as queryDecorGridIntersect, removeFromDecorGrid, verifyDecor } from "../service/geomorph";
import { decorIconRadius, gmScale } from "../world/const";

import useStateRef from "../hooks/use-state-ref";
import GmSprites from "./GmSprites";
import { tempMatrix1 } from "./Misc";

/**
 * @param {Props} props
 */
export default function Decor(props) {
  const { api } = props;
  const { gms } = api.gmGraph;

  const state = useStateRef(/** @type {() => State} */ () => ({
    gfx: new Graphics(),
    mat: gms.map(gm =>
      new Matrix(gmScale, 0, 0, gmScale, -gmScale * gm.pngRect.x, -gmScale * gm.pngRect.y)
        .append(tempMatrix1.set(...gm.inverseMatrix.toArray()))  
    ),
    tex: gms.map(gm => RenderTexture.create({ width: gmScale * gm.pngRect.width, height: gmScale * gm.pngRect.height, resolution: window.devicePixelRatio })),
    showColliders: false,

    byGrid: [],
    byRoom: api.gmGraph.gms.map(_ => []),
    decor: {},
    rootEl: /** @type {HTMLDivElement} */ ({}),
    ready: true,

    eraseDecor(gmId, decorKeys) {
      const ds = decorKeys.map(x => state.decor[x]);
      const gfx = state.gfx.clear();
      gfx.transform.setFromMatrix(state.mat[gmId]);
      gfx.blendMode = BLEND_MODES.ERASE;
      const needRedraw = /** @type {{ [decorKey: string]: NPC.DecorDef }} */ ({});
      
      for (const d of ds) {
        const rect = getDecorRect(d);
        gfx.beginFill();
        gfx.drawRect(rect.x, rect.y, rect.width, rect.height);
        gfx.endFill();

        // find overlapping for redraw
        queryDecorGridIntersect(rect, state.byGrid).forEach(other =>
          !decorKeys.includes(other.key) && (needRedraw[other.key] = other)
        );
      }
      api.renderInto(state.gfx, state.tex[gmId], false);
      gfx.blendMode = BLEND_MODES.NORMAL;

      gfx.blendMode = BLEND_MODES.DST_ATOP;
      gfx.clear(); // Redraw any overlapping:
      Object.values(needRedraw).forEach(d => state.renderDecor(d));
      api.renderInto(gfx, state.tex[gmId], false);
      gfx.blendMode = BLEND_MODES.NORMAL;
    },
    initByRoom(gmId) {
      const gm = gms[gmId];
      state.byRoom[gmId] = gm.gmRoomDecor;
      gm.gmRoomDecor.forEach(({ colliders, points, decor }) => {
        Object.assign(state.decor, decor);
        points.forEach(d => addToDecorGrid(d, getDecorRect(d), state.byGrid))
        colliders.forEach(d => addToDecorGrid(d, getDecorRect(d), state.byGrid))
      });
    },
    initTex(gmId) {
      const gfx = state.gfx.clear();
      gfx.transform.setFromMatrix(state.mat[gmId]);
      state.byRoom[gmId].forEach(({ decor }, _roomId) => {
        Object.values(decor).map(d => state.renderDecor(d));
      });
      api.renderInto(gfx, state.tex[gmId], true);
    },
    getDecorInRoom(gmId, roomId, onlyColliders = false) {
      const atRoom = state.byRoom[gmId][roomId];
      return onlyColliders ? atRoom.colliders : Object.values(atRoom.decor);
    },
    getDecorAtPoint(point, gmId, roomId) {
      // 🚧 use grid
      const closeDecor = state.getDecorInRoom(gmId, roomId);
      return closeDecor.filter(decor => decorContainsPoint(decor, point));
    },
    onClick(e) {
      const el = e.target;
      if (el instanceof HTMLDivElement && el.dataset.key) {
        const item = state.decor[el.dataset.key];
        api.npcs.events.next({ key: 'decor-click', decor: item });
      }
    },
    clearHitTestRoom(gmId, roomId) {
      const gm = gms[gmId];
      const radius = decorIconRadius + 1;
      const gfx = state.gfx.clear().setTransform(-gm.pngRect.x, -gm.pngRect.y);

      gfx.blendMode = BLEND_MODES.ERASE;
      const { points } = api.decor.byRoom[gmId][roomId];
      points.forEach((d) => {
        const local = gm.toLocalCoords(d);
        gfx.beginFill('black');
        gfx.drawRect(local.x - radius, local.y - radius, 2 * radius, 2 * radius);
        gfx.endFill();
      });
      api.renderInto(gfx, api.geomorphs.hit[gmId], false);
      gfx.clear().blendMode = BLEND_MODES.NORMAL;
    },
    redrawHitTestRoom(gmId, roomId) {
      const gm = gms[gmId];
      const radius = decorIconRadius + 1;
      const gfx = state.gfx.clear().setTransform(-gm.pngRect.x, -gm.pngRect.y);

      const { points } = api.decor.byRoom[gmId][roomId];
      points.forEach((d, pointId) => {
        const center = gm.toLocalCoords(d);
        gfx.beginFill(`rgba(127, ${roomId}, ${pointId}, 1)`);
        gfx.drawCircle(center.x, center.y, radius);
        gfx.endFill();
      });

      api.renderInto(gfx, api.geomorphs.hit[gmId], false);
      api.debug.opts.debugHit && api.debug.render();
    },
    removeDecor(decorKeys) {// Assume all decor in same room
      const ds = decorKeys.map(x => state.decor[x]).filter(Boolean);
      decorKeys = ds.map(d => d.key); // Normalization
      if (!ds.length) {
        return;
      }
      
      const { gmId, roomId } = ds[0].meta;
      const atRoom = state.byRoom[gmId][roomId];

      state.clearHitTestRoom(gmId, roomId);
      // Also redraw any overlapping
      state.eraseDecor(gmId, decorKeys);

      const points = ds.filter(isDecorPoint);
      atRoom.points = atRoom.points.filter(d => !points.includes(d));

      const colliders = ds.filter(isCollidable);
      atRoom.colliders = atRoom.colliders.filter(d => !colliders.includes(d));
      colliders.forEach(d => removeFromDecorGrid(d, state.byGrid));

      ds.forEach(d => {
        delete state.decor[d.key];
        delete atRoom.decor[d.key];
      });

      state.redrawHitTestRoom(gmId, roomId);
      api.npcs.events.next({ key: 'decors-removed', decors: ds });
      
    },
    renderDecor(decor) {// Texture manipulation done elsewhere
      const gfx = state.gfx;
      switch (decor.type) {
        case 'circle':
          if (!state.showColliders) break;
          gfx.lineStyle({ color: '#ffffff11', width: 1 });
          gfx.beginFill(0, 0);
          gfx.drawCircle(decor.center.x, decor.center.y, decor.radius);
          gfx.endFill();
          break;
        case 'point':
          gfx.lineStyle({ color: '#77777733', width: 2 });
          gfx.beginFill(0);
          gfx.drawCircle(decor.x, decor.y, decorIconRadius + 1);
          gfx.endFill();
          // 🚧 render icons
          // imageService.lookup[metaToImageHref(decor.meta)]
          // gfx.beginTextureFill({ texture: iconTex });
          // gfx.drawRect(decor.x - iconRadius,decor.y - iconRadius,2 * iconRadius,2 * iconRadius);
          // gfx.endFill();
          break;
        case 'rect':
          if (!state.showColliders) break;
          gfx.lineStyle({ color: '#ffffff11', width: 1 });
          // ctxt.setLineDash([2, 2]);
          if (decor.derivedPoly) {// Should always exist
            gfx.beginFill(0, 0);
            gfx.drawPolygon(decor.derivedPoly.outline);
            gfx.endFill();
          }
          break;
        default:
          throw testNever(decor);
      }
    },
    setDecor(gmId, ...ds) {
      /**
       * Decor needn't reside in same room,
       * e.g. because this is directly connected to CLI.
       * However, we __do__ assume `gmId` is constant.
       */
      if (ds.length === 0) {
        return;
      }

      // Remove existing decor
      // Cannot absorb these Graphics operations below
      ds.filter(d => d.key in state.decor).forEach(d => {
        d.updatedAt = Date.now();
        state.removeDecor([d.key]); // ℹ️ cannot batch: must be in same room
      });

      const roomIds = removeDups(ds.map(d => d.meta.roomId));
      roomIds.forEach(roomId => state.clearHitTestRoom(gmId, roomId));

      state.gfx.clear();
      state.gfx.transform.setFromMatrix(state.mat[gmId]);

      for (const d of ds) {
        if (!d || !verifyDecor(d)) {
          throw Error(`invalid decor: ${JSON.stringify(d)}`);
        }
        const { roomId } = ensureDecorMetaGmRoomId(d, api.gmGraph);
        normalizeDecor(d);

        d.key in state.decor && removeFromDecorGrid(state.decor[d.key], state.byGrid);
        addToDecorGrid(d, getDecorRect(d), state.byGrid);

        state.decor[d.key] = d;
        const atRoom = state.byRoom[gmId][roomId];
        atRoom.decor[d.key] = d;
        removeFirst(atRoom[isDecorPoint(d) ? 'points' : 'colliders'], d).push(d);
        
        state.renderDecor(d);
      }

      api.renderInto(state.gfx, state.tex[gmId], false);
      // // 🚧 If points are updated they need to be cleared...
      // // Must redraw hit canvas rooms when points are added/updated
      // removeDups(ds.map(d => d.meta.roomId)).forEach(roomId =>
      //   state.redrawHitCanvas(gmId, roomId, state.byRoom[gmId][roomId].points)
      // );
      roomIds.forEach(roomId => state.redrawHitTestRoom(gmId, roomId));

      api.npcs.events.next({ key: 'decors-added', decors: ds });
    },
  }));

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <GmSprites
      gms={gms}
      tex={state.tex}
    />
  );
}

/**
 * @param {Geomorph.PointMeta} meta
 * @returns {import("projects/service/image").ImageServiceHref}
 */
function metaToImageHref(meta) {
  if (meta.stand) return '/assets/icon/standing-person.png';
  if (meta.sit) return '/assets/icon/sitting-silhouette.invert.svg';
  if (meta.lie) return '/assets/icon/lying-man.invert.svg';
  if (meta.label) return '/assets/icon/info-icon.invert.svg';
  return '/assets/icon/road-works.invert.svg'; // Fallback
}

/**
 * @typedef Props
 * @property {import('./WorldPixi').State} api
 * @property {(api: State) => void} onLoad
 */

/**
 * @typedef DecorInstanceProps
 * @property {NPC.DecorDef} def
 */

/**
 * @typedef State
 * @property {NPC.DecorGrid} byGrid
 * Collidable decors in global grid where `byGrid[x][y]` covers the square:
 * (x * decorGridSize, y * decorGridSize, decorGridSize, decorGridSize)
 * @property {NPC.RoomDecorCache[][]} byRoom
 * Decor organised by `byRoom[gmId][roomId]`.
 * @property {import('pixi.js').Graphics} gfx
 * @property {import('pixi.js').Matrix[]} mat
 * @property {import('pixi.js').RenderTexture[]} tex
 * @property {boolean} showColliders
 * @property {Record<string, NPC.DecorDef>} decor
 * All decor, including children of groups.
 * @property {boolean} ready
 * @property {HTMLElement} rootEl
 *
 * @property {(gmId: number, decorKeys: string[]) => void} eraseDecor
 * @property {(gmId: number, roomId: number, onlyColliders?: boolean) => NPC.DecorDef[]} getDecorInRoom
 * Get all decor in specified room.
 * @property {(point: Geom.VectJson, gmId: number, roomId: number) => NPC.DecorDef[]} getDecorAtPoint
 * Get all decor in same room as point which intersects point.
 * @property {(gmId: number) => void} initByRoom
 * @property {(gmId: number) => void} initTex
 * @property {(e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void} onClick
 * @property {(gmId: number, roomId: number) => void} clearHitTestRoom
 * @property {(gmId: number, roomId: number) => void} redrawHitTestRoom
 * @property {(decorKeys: string[]) => void} removeDecor Must all be in same room
 * @property {(decor: NPC.DecorDef) => void} renderDecor
 * @property {(gmId: number, ...decor: NPC.DecorDef[]) => void} setDecor
 */

/**
 * @typedef ToggleLocalDecorOpts
 * @property {Geomorph.GmRoomId[]} [added]
 * @property {Geomorph.GmRoomId[]} [removed]
 */
