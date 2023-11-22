import React from "react";
import { useQuery } from "@tanstack/react-query";
import { BLEND_MODES, RenderTexture, Matrix } from "@pixi/core";
import { Graphics } from "@pixi/graphics";
import { Assets } from "@pixi/assets";

import { removeDups, removeFirst, testNever } from "../service/generic";
import { addToDecorGrid, decorContainsPoint, ensureDecorMetaGmRoomId, getDecorRect, getGmRoomKey, isCollidable, isDecorPoint, normalizeDecor, queryDecorGridIntersect, removeFromDecorGrid, verifyDecor } from "../service/geomorph";
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
  
  useQuery({
    queryKey: [`decor-icon-textures`],
    queryFn: async () => {
      await Promise.all(/** @type {const} */ ([
        { key: 'standing', filename: 'standing-person.png'},
        { key: 'sitting', filename: 'sitting-silhouette.invert.svg'},
        { key: 'lying', filename: 'lying-man.invert.svg'},
        { key: 'info', filename: 'info-icon.invert.svg'},
        { key: 'road-works', filename: 'road-works.invert.svg'},
      ]).map(async ({ key, filename }) =>
        state.icon[key] = await Assets.load(`/assets/icon/${filename}`)
      ));

      console.log(state.icon)

      props.onLoad(state); // ready when icons loaded
      return null;
    },
    throwOnError: true,
  });

  const state = useStateRef(/** @type {() => State} */ () => ({
    gfx: new Graphics(),
    mat: gms.map(gm =>
      new Matrix(gmScale, 0, 0, gmScale, -gmScale * gm.pngRect.x, -gmScale * gm.pngRect.y)
        .append(tempMatrix1.set(...gm.inverseMatrix.toArray()))  
    ),
    tex: gms.map(gm => RenderTexture.create({ width: gmScale * gm.pngRect.width, height: gmScale * gm.pngRect.height, resolution: window.devicePixelRatio })),
    icon: /** @type {*} */ ({}),
    showColliders: false,

    byGrid: [],
    byRoom: api.gmGraph.gms.map(_ => []),
    decor: {},
    rootEl: /** @type {HTMLDivElement} */ ({}),
    ready: true,

    addDecor(ds) {
      const grouped = ds.reduce((agg, d) => {
        if (!verifyDecor(d)) {
          throw Error(`invalid decor: ${JSON.stringify(d)}`);
        }
        // Add decor to addition group
        const { gmId, roomId } = ensureDecorMetaGmRoomId(d, api.gmGraph);
        (agg[getGmRoomKey(gmId, roomId)] ??= { gmId, roomId, add: [], remove: [] }).add.push(d);
        
        // Add pre-existing decor to removal group
        const prev = state.decor[d.key];
        if (prev) {
          d.updatedAt = Date.now();
          const { gmId, roomId } = prev.meta;
          (agg[getGmRoomKey(gmId, roomId)] ??= { gmId, roomId, add: [], remove: [] }).remove.push(prev);
        }
        return agg;
      }, /** @type {Record<string, { gmId: number; roomId: number; add: NPC.DecorDef[]; remove: NPC.DecorDef[]; }>} */ ({}));

      Object.values(grouped).forEach(({ gmId, roomId, add, remove }) => {
        state.removeRoomDecor(gmId, roomId, remove);
        state.addRoomDecor(gmId, roomId, add);
      });
    },
    addRoomDecor(gmId, roomId, ds) {
      // We assume the provided decor does not currently exist
      if (ds.length === 0) {
        return;
      }

      const roomIds = removeDups(ds.map(d => d.meta.roomId));
      roomIds.forEach(roomId => state.clearHitTestRoom(gmId, roomId));

      state.gfx.clear();
      state.gfx.transform.setFromMatrix(state.mat[gmId]);
      for (const d of ds) {
        normalizeDecor(d);

        // d.key in state.decor && removeFromDecorGrid(state.decor[d.key], state.byGrid);
        addToDecorGrid(d, getDecorRect(d), state.byGrid);

        state.decor[d.key] = d;
        const atRoom = state.byRoom[gmId][roomId];
        atRoom.decor[d.key] = d;
        removeFirst(atRoom[isDecorPoint(d) ? 'points' : 'colliders'], d).push(d);
        
        state.renderDecor(d);
      }

      // existing.forEach(d => state.decor[d.key].updatedAt = Date.now());
      api.renderInto(state.gfx, state.tex[gmId], false);
      roomIds.forEach(roomId => state.redrawHitTestRoom(gmId, roomId));

      api.npcs.events.next({ key: 'decors-added', decors: ds });
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
    eraseDecor(gmId, ds) {
      // Not restricted by roomId e.g. overlapping decor can be from other rooms
      const gfx = state.gfx.clear();
      gfx.transform.setFromMatrix(state.mat[gmId]);
      gfx.blendMode = BLEND_MODES.ERASE;
      const needRedraw = /** @type {{ [decorKey: string]: NPC.DecorDef }} */ ({});
      const decorKeys = ds.map(d => d.key);
      
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

      // Redraw any overlapping
      gfx.blendMode = BLEND_MODES.DST_ATOP;
      gfx.clear();
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
    getDecorAtPoint(point, gmId, roomId) {
      // 🚧 use grid
      const closeDecor = state.getDecorInRoom(gmId, roomId);
      return closeDecor.filter(decor => decorContainsPoint(decor, point));
    },
    getDecorInRoom(gmId, roomId, onlyColliders = false) {
      const atRoom = state.byRoom[gmId][roomId];
      return onlyColliders ? atRoom.colliders : Object.values(atRoom.decor);
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
    removeDecor(decorKeys) {
      const ds = decorKeys.map(x => state.decor[x]).filter(Boolean);
      decorKeys = ds.map(d => d.key);

      const grouped = ds.reduce((agg, d) => {
        const { gmId, roomId } = d.meta;
        (agg[getGmRoomKey(gmId, roomId)] ??= { gmId, roomId, ds }).ds.push(d);
        return agg;
      }, /** @type {Record<string, { gmId: number; roomId: number; ds: NPC.DecorDef[] }>} */ ({}));

      Object.values(grouped).forEach(({ gmId, roomId, ds }) =>
        state.removeRoomDecor(gmId, roomId, ds)
      );
    },
    removeRoomDecor(gmId, roomId, ds) {
      if (!ds.length) {
        return;
      }

      const atRoom = state.byRoom[gmId][roomId];
      state.clearHitTestRoom(gmId, roomId);
      state.eraseDecor(gmId, ds); // redraws overlapping

      const points = ds.filter(isDecorPoint);
      atRoom.points = atRoom.points.filter(d => !points.includes(d));
      points.forEach(d => removeFromDecorGrid(d, state.byGrid));

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
          const radius = decorIconRadius;
          // background circle
          gfx.lineStyle({ color: '#77777777', width: 1 });
          gfx.beginFill(0);
          gfx.drawCircle(decor.x, decor.y, radius + 1);
          gfx.endFill();

          // icon
          const { meta } = decor;
          const texture = state.icon[
            meta.stand && 'standing' || 
            meta.sit && 'sitting' || 
            meta.lie && 'lying' || 
            meta.label && 'info' || 
              'road-works'
          ];
          const scale = (2 * radius) / texture.width;
          // ℹ️ can ignore transform of `gfx`
          const matrix = tempMatrix1.set(scale, 0, 0, scale, decor.x - radius, decor.y - radius);
          gfx.line.width = 0;
          gfx.beginTextureFill({ texture, matrix });
          gfx.drawRect(decor.x - radius, decor.y - radius, 2 * radius, 2 * radius);
          gfx.endFill();
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
  }));

  // React.useEffect(() => {
  //   props.onLoad(state);
  // }, []);

  return (
    <GmSprites
      gms={gms}
      tex={state.tex}
    />
  );
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
 * @property {Record<DecorIconKey, import('pixi.js').Texture<import('pixi.js').Resource>>} icon
 * 
 * @property {boolean} showColliders
 * @property {Record<string, NPC.DecorDef>} decor
 * All decor, including children of groups.
 * @property {boolean} ready
 * @property {HTMLElement} rootEl
 *
 * @property {(decor: NPC.DecorDef[]) => void} addDecor
 * @property {(gmId: number, decors: NPC.DecorDef[]) => void} eraseDecor
 * @property {(gmId: number, roomId: number, onlyColliders?: boolean) => NPC.DecorDef[]} getDecorInRoom
 * Get all decor in specified room.
 * @property {(point: Geom.VectJson, gmId: number, roomId: number) => NPC.DecorDef[]} getDecorAtPoint
 * Get all decor in same room as point which intersects point.
 * @property {(gmId: number) => void} initByRoom
 * @property {(gmId: number) => void} initTex
 * @property {(gmId: number, roomId: number) => void} clearHitTestRoom
 * @property {(gmId: number, roomId: number) => void} redrawHitTestRoom
 * @property {(decorKeys: string[]) => void} removeDecor
 * @property {(gmId: number, roomId: number, decors: NPC.DecorDef[]) => void} removeRoomDecor
 * @property {(decor: NPC.DecorDef) => void} renderDecor
 * @property {(gmId: number, roomId: number, decors: NPC.DecorDef[]) => void} addRoomDecor
 */

/**
 * @typedef ToggleLocalDecorOpts
 * @property {Geomorph.GmRoomId[]} [added]
 * @property {Geomorph.GmRoomId[]} [removed]
 */

/**
 * @typedef {(
 *  | 'standing'
 *  | 'sitting'
 *  | 'lying'
 *  | 'info'
 *  | 'road-works'
 * )} DecorIconKey
 */
