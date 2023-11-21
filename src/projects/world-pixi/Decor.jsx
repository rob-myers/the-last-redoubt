import React from "react";
import { BLEND_MODES, RenderTexture, Matrix } from "@pixi/core";
import { Graphics } from "@pixi/graphics";
import { testNever } from "../service/generic";

import { addToDecorGrid, decorContainsPoint, ensureDecorMetaGmRoomId, getDecorRect, isCollidable, isDecorPoint, normalizeDecor, removeFromDecorGrid, verifyDecor } from "../service/geomorph";
import { gmScale } from "../world/const";

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

    clearDecor(gmId, roomId) {
      const gfx = state.gfx.clear();
      gfx.transform.setFromMatrix(state.mat[gmId]);
      gfx.blendMode = BLEND_MODES.ERASE;
      gfx.beginFill();
      gfx.drawPolygon(gms[gmId].roomsWithDoors[roomId].outline);
      gfx.endFill();
      api.renderInto(state.gfx, state.tex[gmId], false);
      gfx.blendMode = BLEND_MODES.NORMAL;
    },
    initByRoom(gmId) {
      const gm = gms[gmId];
      state.byRoom[gmId] = gm.gmRoomDecor;
      gm.gmRoomDecor.forEach(({ colliders, decor }) => {
        Object.assign(state.decor, decor);
        colliders.forEach(d => addToDecorGrid(d, getDecorRect(d), state.byGrid))
      });
    },
    initTex(gmId) {
      state.gfx.clear();
      state.gfx.transform.setFromMatrix(state.mat[gmId]);
      state.byRoom[gmId].forEach((_, roomId) => state.renderDecor(gmId, roomId));
      api.renderInto(state.gfx, state.tex[gmId]);
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
    redrawHitCanvas(gmId, roomId, nextPoints) {
      const gm = gms[gmId];
      const radius = 5; // 🚧 hard-coded radius
      const gfx = state.gfx.clear().setTransform(-gm.pngRect.x, -gm.pngRect.y);

      gfx.blendMode = BLEND_MODES.ERASE;
      const { points: prevPoints } = api.decor.byRoom[gmId][roomId];
      prevPoints.forEach((d) => {
        const local = gm.toLocalCoords(d);
        gfx.beginFill('black');
        gfx.drawRect(local.x - radius, local.y - radius, 2 * radius, 2 * radius);
        gfx.endFill();
      });
      api.renderInto(gfx, api.geomorphs.hit[gmId], false);
      gfx.clear().blendMode = BLEND_MODES.NORMAL;

      nextPoints.forEach((d, pointId) => {
        const center = gm.toLocalCoords(d);
        gfx.beginFill(`rgba(127, ${roomId}, ${pointId}, 1)`);
        gfx.drawCircle(center.x, center.y, radius);
        gfx.endFill();
      });

      api.renderInto(gfx, api.geomorphs.hit[gmId], false);
      api.debug.opts.debugHit && api.debug.render();
    },
    removeDecor(decorKeys) {// Assume all decor in same room
      const ds = decorKeys.map(decorKey => state.decor[decorKey]);
      if (!ds.length) {
        return;
      }
      const { gmId, roomId } = ds[0].meta;
      const atRoom = state.byRoom[gmId][roomId];

      const points = ds.filter(isDecorPoint);
      if (points.length) {
        const nextPoints = atRoom.points.filter(d => !points.includes(d));
        state.redrawHitCanvas(gmId, roomId, nextPoints);
        atRoom.points = nextPoints;
      }

      const colliders = ds.filter(isCollidable);
      if (colliders.length) {
        atRoom.colliders = atRoom.colliders.filter(d => !colliders.includes(d));
        colliders.forEach(d => removeFromDecorGrid(d, state.byGrid));
      }

      ds.forEach(d => {
        delete state.decor[d.key];
        delete atRoom.decor[d.key];
      });
      api.npcs.events.next({ key: 'decors-removed', decors: ds });
      
      state.clearDecor(gmId, roomId);
      state.renderDecor(gmId, roomId);
    },
    renderDecor(gmId, roomId) {
      const ds = Object.values(state.byRoom[gmId][roomId].decor);
      
      // 🚧 restrict to room via mask
      const gfx = state.gfx;
      for (const decor of ds) {
        if (isCollidable(decor) && !state.showColliders) {
          continue;
        }
        switch (decor.type) {
          case 'circle':
            gfx.lineStyle({ color: '#ffffff11', width: 1 });
            // ctxt.setLineDash([2, 2]);
            gfx.beginFill(0, 0);
            gfx.drawCircle(decor.center.x, decor.center.y, decor.radius);
            gfx.endFill();
            break;
          case 'point':
            const iconRadius = 4;
            gfx.lineStyle({ color: '#77777733', width: 2 });
            gfx.beginFill(0);
            gfx.drawCircle(decor.x, decor.y, 5);
            gfx.endFill();
            // 🚧 render icons
            // imageService.lookup[metaToImageHref(decor.meta)]
            // gfx.beginTextureFill({ texture: iconTex });
            // gfx.drawRect(decor.x - iconRadius,decor.y - iconRadius,2 * iconRadius,2 * iconRadius);
            // gfx.endFill();
            break;
          case 'rect':
            gfx.lineStyle({ color: '#ffffff33', width: 1 });
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
      }
      api.renderInto(gfx, state.tex[gmId], false);
    },
    setDecor(...ds) {
      // 🚧 is existing decor being removed from e.g. colliders?
      if (ds.length === 0) {
        return;
      }
      ds.forEach(d => {
        if (!d || !verifyDecor(d))
          throw Error(`invalid decor: ${JSON.stringify(d)}`);
      });

      // Every decor must lie in same room
      const { gmId, roomId } = ds[0].meta;
      const atRoom = state.byRoom[gmId][roomId];
      const points = /** @type {NPC.DecorPoint[]} */ ([]);

      for (const d of ds) {
        if (state.decor[d.key]) {
          d.updatedAt = Date.now();
        }
        ensureDecorMetaGmRoomId(d, api.gmGraph);
        normalizeDecor(d);
        atRoom.decor[d.key] = d;

        if (isCollidable(d)) {
          atRoom.colliders.push(d);
          d.key in state.decor && removeFromDecorGrid(d, state.byGrid);
          addToDecorGrid(d, getDecorRect(d), state.byGrid);
        } else if (isDecorPoint(d)) {
          points.push(d);
        }
        state.decor[d.key] = d;
      }

      if (points.length) {
        state.redrawHitCanvas(gmId, roomId, points); // redraw handles updated decor
        atRoom.points = atRoom.points.filter(x => !points.some(y => x.key === y.key)).concat(points);
      }

      api.npcs.events.next({ key: 'decors-added', decors: ds });
      state.renderDecor(gmId, roomId);
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
 * @property {(gmId: number, roomId: number) => void} clearDecor
 * @property {(gmId: number, roomId: number, onlyColliders?: boolean) => NPC.DecorDef[]} getDecorInRoom
 * Get all decor in specified room.
 * @property {(point: Geom.VectJson, gmId: number, roomId: number) => NPC.DecorDef[]} getDecorAtPoint
 * Get all decor in same room as point which intersects point.
 * @property {(gmId: number) => void} initByRoom
 * @property {(gmId: number) => void} initTex
 * @property {(e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void} onClick
 * @property {(gmId: number, roomId: number, nextPoints: NPC.DecorPoint[]) => void} redrawHitCanvas
 * @property {(decorKeys: string[]) => void} removeDecor Assumed to be in same room
 * @property {(gmId: number, roomId: number) => void} renderDecor
 * @property {(...decor: NPC.DecorDef[]) => void} setDecor
 */

/**
 * @typedef ToggleLocalDecorOpts
 * @property {Geomorph.GmRoomId[]} [added]
 * @property {Geomorph.GmRoomId[]} [removed]
 */
