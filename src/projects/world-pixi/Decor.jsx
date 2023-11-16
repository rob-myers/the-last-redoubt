import React from "react";
import { BLEND_MODES } from "@pixi/core";
import { testNever } from "../service/generic";
import { drawCircle, strokePolygons } from "../service/dom";
import { imageService } from "projects/service/image";
import { addToDecorGrid, decorContainsPoint, ensureDecorMetaGmRoomId, getDecorRect, isCollidable, isDecorPoint, normalizeDecor, removeFromDecorGrid, verifyDecor } from "../service/geomorph";

import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Decor(props) {
  const { api } = props;
  const { gms } = api.gmGraph;

  const state = useStateRef(/** @type {() => State} */ () => ({
    ctxts: [],
    showColliders: false,

    byGrid: [],
    byRoom: api.gmGraph.gms.map(_ => []),
    decor: {},
    rootEl: /** @type {HTMLDivElement} */ ({}),
    ready: true,

    initByRoom(gmId) {
      const gm = gms[gmId];
      state.byRoom[gmId] = gm.gmRoomDecor;
      gm.gmRoomDecor.forEach(({ colliders, decor }) => {
        Object.assign(state.decor, decor);
        colliders.forEach(d => addToDecorGrid(d, getDecorRect(d), state.byGrid))
      });
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
      const gfx = api.geomorphs.gfx.clear().setTransform(-gm.pngRect.x, -gm.pngRect.y);
      gfx.blendMode = BLEND_MODES.ERASE; // clear
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
    removeDecor(decorKeys) {
      const ds = decorKeys.map(decorKey => state.decor[decorKey])
        // cannot remove read-only group or its items
        // .filter(d => d && !localDecorGroupRegex.test(d.key))
      ;
      if (!ds.length) {
        return;
      }

      // Assume all decor we are deleting comes from same room
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

      // 🚧 `ds` could contain dups e.g. `decorKeys` could mention group & child
      api.npcs.events.next({ key: 'decors-removed', decors: ds });

      state.render();
    },
    setDecor(...ds) {
      if (ds.length === 0) {
        return;
      }
      ds.forEach(d => {
        if (!d || !verifyDecor(d))
          throw Error(`invalid decor: ${JSON.stringify(d)}`);
      });

      // 🚧 needs a rewrite
      // 🚧 is existing decor being removed from e.g. colliders?

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
      state.render();
    },

    renderDecor(ctxt, decor) {
      if (!state.showColliders && isCollidable(decor)) {
        return;
      }
      switch (decor.type) {
        case 'circle':
          ctxt.strokeStyle = '#ffffff33';
          ctxt.setLineDash([2, 2]);
          drawCircle(ctxt, decor.center, decor.radius);
          ctxt.setLineDash([]);
          break;
        case 'point':
          const iconRadius = 4;
          ctxt.strokeStyle = '#888';
          ctxt.fillStyle = '#000';
          drawCircle(ctxt, { x: decor.x, y: decor.y }, 5);
          ctxt.fill();
          ctxt.drawImage(
            imageService.lookup[metaToImageHref(decor.meta)],
            decor.x - iconRadius,
            decor.y - iconRadius,
            2 * iconRadius,
            2 * iconRadius,
          );
          break;
        case 'rect':
          ctxt.strokeStyle = '#ffffff33';
          ctxt.setLineDash([2, 2]);
          decor.derivedPoly && strokePolygons(ctxt, [decor.derivedPoly]);
          ctxt.setLineDash([]);
          break;
        default:
          throw testNever(decor);
      }
    },
    render() {// 🚧
      // const { ctxts } = state;

      // gms.forEach((gm, gmId) => {
      //   const ctxt = ctxts[gmId];
      //   ctxt.resetTransform();
      //   ctxt.clearRect(0, 0, ctxt.canvas.width, ctxt.canvas.height);

      //   ctxt.transform(
      //     gmScale, 0, 0, gmScale,
      //     -gmScale * gm.pngRect.x, -gmScale * gm.pngRect.y,
      //   );
      //   ctxt.transform(...gm.inverseMatrix.toArray());

      //   state.byRoom[gmId].forEach(({ decor }, roomId) =>
      //     Object.values(decor).forEach(d => state.renderDecor(ctxt, d))
      //   );

      // });
    },
  }));

  React.useEffect(() => {
    // state.initByRoom();
    // state.render();
    props.onLoad(state);
  }, []);

  // return (
  //   <div
  //     className="decor-root"
  //     ref={el => el && (state.rootEl = el)}
  //     onClick={state.onClick}
  //   >
  //     <GmsCanvas
  //       gms={gms}
  //       scaleFactor={gmScale}
  //       canvasRef={(el, gmId) => state.ctxts[gmId] = assertNonNull(el.getContext('2d'))}
  //     />
  //   </div>
  // );
  return null;
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
 * @property {CanvasRenderingContext2D[]} ctxts
 * @property {boolean} showColliders
 * @property {Record<string, NPC.DecorDef>} decor
 * All decor, including children of groups.
 * @property {HTMLElement} rootEl
 * @property {NPC.DecorGrid} byGrid
 * Collidable decors in global grid where `byGrid[x][y]` covers the square:
 * (x * decorGridSize, y * decorGridSize, decorGridSize, decorGridSize)
 * @property {NPC.RoomDecorCache[][]} byRoom
 * Decor organised by `byRoom[gmId][roomId]`.
 * @property {(gmId: number, roomId: number, onlyColliders?: boolean) => NPC.DecorDef[]} getDecorInRoom
 * Get all decor in specified room.
 * @property {(point: Geom.VectJson, gmId: number, roomId: number) => NPC.DecorDef[]} getDecorAtPoint
 * Get all decor in same room as point which intersects point.
 * @property {boolean} ready
 * @property {(e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void} onClick
 * @property {(gmId: number, roomId: number, nextPoints: NPC.DecorPoint[]) => void} redrawHitCanvas
 * @property {(decorKeys: string[]) => void} removeDecor
 * Remove decor, all assumed to be in same room
 * @property {(gmId: number) => void} initByRoom
 * @property {(...decor: NPC.DecorDef[]) => void} setDecor
 * @property {(ctxt: CanvasRenderingContext2D, d: NPC.DecorDef) => void} renderDecor
 * @property {() => void} render
 */

/**
 * @typedef ToggleLocalDecorOpts
 * @property {Geomorph.GmRoomId[]} [added]
 * @property {Geomorph.GmRoomId[]} [removed]
 */
