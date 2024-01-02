import React from "react";
import { useQuery } from "@tanstack/react-query";
import { BLEND_MODES, RenderTexture, Matrix } from "@pixi/core";
import { Graphics } from "@pixi/graphics";
import { Assets } from "@pixi/assets";

import { testNever } from "../service/generic";
import { addToDecorGrid, decorContainsPoint, ensureDecorMetaGmRoomId, getDecorRect, getGmRoomKey, isCollidable, isDecorPoint, normalizeDecor, queryDecorGridIntersect, removeFromDecorGrid, verifyDecor } from "../service/geomorph";
import { decorIconRadius, gmScale } from "../world/const";

import useStateRef from "../hooks/use-state-ref";
import GmSprites from "./GmSprites";
import { colMatFilter2 } from "./const";

/**
 * @param {Props} props
 */
export default function Decor(props) {
  const { api } = props;
  const { gms } = api.gmGraph;
  
  // 🚧 move into "decor spritesheet"
  useQuery({
    queryKey: [`decor-icon-textures`],
    queryFn: async () => {
      await Promise.all(/** @type {const} */ ([
        { key: 'circle-right', filename: 'circle-right.svg'},
        { key: 'standing', filename: 'standing-person.invert.svg'},
        { key: 'sitting', filename: 'sitting-silhouette.invert.svg'},
        { key: 'lying', filename: 'lying-man.invert.svg'},
        { key: 'info', filename: 'info-icon.invert.svg'},
        { key: 'road-works', filename: 'road-works.invert.svg'},
      ]).map(async ({ key, filename }) =>
        state.icon[key] = await Assets.load(`/assets/icon/${filename}`)
      ));

      props.onLoad(state); // ready when icons loaded
      return null;
    },
    throwOnError: true,
    gcTime: Infinity,
    staleTime: Infinity,
    refetchOnMount: 'always',
  });

  const state = useStateRef(/** @type {() => State} */ () => ({
    gfx: new Graphics(),
    mat: gms.map(gm =>
      new Matrix(gmScale, 0, 0, gmScale, -gmScale * gm.pngRect.x, -gmScale * gm.pngRect.y)
        .append(tempMatrix.set(...gm.inverseMatrix.toArray()))  
    ),
    tex: gms.map(gm => RenderTexture.create({
      width: gmScale * gm.pngRect.width,
      height: gmScale * gm.pngRect.height,
      // resolution: window.devicePixelRatio > 1 ? 2 : 1,
    })),
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
        }// Add decor to addition group
        const { gmId, roomId } = ensureDecorMetaGmRoomId(d, api.gmGraph);
        (agg[getGmRoomKey(gmId, roomId)] ??= { gmId, roomId, add: [], remove: [] }).add.push(d);
        
        const prev = state.decor[d.key];
        if (prev) {// Add pre-existing decor to removal group
          d.updatedAt = Date.now();
          const { gmId, roomId } = prev.meta;
          (agg[getGmRoomKey(gmId, roomId)] ??= { gmId, roomId, add: [], remove: [] }).remove.push(prev);
        }
        return agg;
      }, /** @type {{ [key: string]: Geomorph.GmRoomId & { [x in 'add' | 'remove']: NPC.DecorDef[] }}} */ ({}));

      Object.values(grouped).forEach(({ gmId, roomId, remove }) =>
        state.removeRoomDecor(gmId, roomId, remove)
      );
      Object.values(grouped).forEach(({ gmId, roomId, add }) =>
        state.addRoomDecor(gmId, roomId, add)
      );
    },
    addRoomDecor(gmId, roomId, ds) {
      // We assume the provided decor does not currently exist
      if (ds.length === 0) {
        return;
      }

      state.gfx.clear();
      state.gfx.transform.setFromMatrix(state.mat[gmId]);

      for (const d of ds) {
        normalizeDecor(d);
        addToDecorGrid(d, state.byGrid);
        state.drawDecor(d);

        state.decor[d.key] = d;
        const atRoom = state.byRoom[gmId][roomId];
        atRoom.decor[d.key] = d;
        isDecorPoint(d) ? atRoom.points.push(d) : atRoom.colliders.push(d);
      }

      api.renderInto(state.gfx, state.tex[gmId], false);
      api.geomorphs.renderHitRoom(gmId, roomId);
      api.debug.opts.debugHit && api.debug.render();

      api.npcs.events.next({ key: 'decors-added', decors: ds });
    },
    drawDecor(decor) {// Render elsewhere
      const gfx = state.gfx;
      switch (decor.type) {
        case 'circle':
          if (!state.showColliders) break;
          gfx.lineStyle({ color: '#ffffff11', width: 1 });
          gfx.beginFill(0xff0000, 0.025);
          gfx.drawCircle(decor.center.x, decor.center.y, decor.radius);
          gfx.endFill();
          break;
        case 'point':
          const radius = decorIconRadius + 1;
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
          const matrix = tempMatrix.set(scale, 0, 0, scale, decor.x - radius, decor.y - radius);
          gfx.line.width = 0;
          gfx.beginTextureFill({ texture, matrix });
          gfx.drawRect(decor.x - radius, decor.y - radius, 2 * radius, 2 * radius);
          gfx.endFill();
          break;
        case 'rect':
          if (!state.showColliders) break;
          gfx.lineStyle({ color: '#ffffff22', width: 1 });
          if (decor.derivedPoly) {// Should always exist
            gfx.beginFill(0xff0000, 0.025);
            gfx.drawPolygon(decor.derivedPoly.outline);
            gfx.endFill();
          }
          break;
        default:
          throw testNever(decor);
      }
    },
    eraseDecor(gmId, ds) {
      // Not restricted by roomId (overlapping decor can be from other rooms)
      const gfx = state.gfx.clear();
      gfx.transform.setFromMatrix(state.mat[gmId]);
      const shouldErase = ds.reduce((agg, d) => (agg[d.key] = true, agg), /** @type {Record<string, true>} */ ({}));
      
      for (const d of ds) {
        // erase `rect` bounding decor `d`
        const rect = getDecorRect(d);
        gfx.clear().blendMode = BLEND_MODES.ERASE;
        gfx.beginFill(); gfx.drawRect(rect.x, rect.y, rect.width, rect.height);
        api.renderInto(gfx, state.tex[gmId], false);

        // redraw close decor into `rect`
        const { colliders, points } = queryDecorGridIntersect(rect, state.byGrid);
        const topLeft = state.mat[gmId].apply({ x: rect.x, y: rect.y });
        const texRect = { x: topLeft.x, y: topLeft.y, width: rect.width * gmScale, height: rect.height * gmScale };
        gfx.clear().blendMode = BLEND_MODES.NORMAL;
        Object.values(colliders).forEach(d => !shouldErase[d.key] && (gmId === d.meta.gmId) && state.drawDecor(d));
        Object.values(points).forEach(d => !shouldErase[d.key] && (gmId === d.meta.gmId) && state.drawDecor(d));
        api.renderRect(gfx, state.tex[gmId], texRect);
      }
    },
    initLookups(gmId) {
      const gm = gms[gmId];
      state.byRoom[gmId] = gm.gmRoomDecor;
      gm.gmRoomDecor.forEach(({ colliders, points, decor }) => {
        Object.assign(state.decor, decor);
        points.forEach(d => addToDecorGrid(d, state.byGrid))
        colliders.forEach(d => addToDecorGrid(d, state.byGrid))
      });
    },
    initTex(gmId) {
      const gfx = state.gfx.clear();
      gfx.transform.setFromMatrix(state.mat[gmId]);
      state.byRoom[gmId].forEach(({ decor }, _roomId) => {
        Object.values(decor).map(d => state.drawDecor(d));
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
    renderAll() {
      gms.map((_, gmId) => setTimeout(() => state.initTex(gmId)));
    },
    removeDecor(decorKeys) {
      const ds = decorKeys.map(x => state.decor[x]).filter(Boolean);

      const grouped = ds.reduce((agg, d) => {
        const { gmId, roomId } = d.meta;
        (agg[getGmRoomKey(gmId, roomId)] ??= { gmId, roomId, ds: [] }).ds.push(d);
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

      // erase and redraw overlapping
      state.eraseDecor(gmId, state.showColliders ? ds : ds.filter(isDecorPoint));
      
      // update data structures
      const atRoom = state.byRoom[gmId][roomId];
      ds.forEach(d => {
        delete state.decor[d.key];
        delete atRoom.decor[d.key];
      });
      const points = ds.filter(isDecorPoint);
      atRoom.points = atRoom.points.filter(d => !points.includes(d));
      points.forEach(d => removeFromDecorGrid(d, state.byGrid));
      const colliders = ds.filter(isCollidable);
      atRoom.colliders = atRoom.colliders.filter(d => !colliders.includes(d));
      colliders.forEach(d => removeFromDecorGrid(d, state.byGrid));

      api.geomorphs.renderHitRoom(gmId, roomId);
      api.debug.opts.debugHit && api.debug.render();

      api.npcs.events.next({ key: 'decors-removed', decors: ds });
    },
  }));

  React.useEffect(() => {
    process.env.NODE_ENV === 'development' && api.isReady() && state.renderAll();
  }, []);

  return (
    <GmSprites
      gms={gms}
      tex={state.tex}
      filters={[colMatFilter2]}
      visible={api.visibleGms}
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
 * @property {(gmId: number) => void} initLookups
 * @property {(gmId: number) => void} initTex
 * @property {() => void} renderAll
 * @property {(decorKeys: string[]) => void} removeDecor
 * @property {(gmId: number, roomId: number, decors: NPC.DecorDef[]) => void} removeRoomDecor
 * @property {(decor: NPC.DecorDef) => void} drawDecor
 * @property {(gmId: number, roomId: number, decors: NPC.DecorDef[]) => void} addRoomDecor
 */

/**
 * @typedef ToggleLocalDecorOpts
 * @property {Geomorph.GmRoomId[]} [added]
 * @property {Geomorph.GmRoomId[]} [removed]
 */

/**
 * @typedef {(
 *  | 'circle-right'
 *  | 'standing'
 *  | 'sitting'
 *  | 'lying'
 *  | 'info'
 *  | 'road-works'
 * )} DecorIconKey
 */

const tempMatrix = new Matrix;
