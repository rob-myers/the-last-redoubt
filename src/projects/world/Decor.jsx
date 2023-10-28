import React from "react";
import { gmScale } from "./const";
import { assertNonNull, testNever } from "../service/generic";
import { drawCircle, strokePolygons } from "../service/dom";
import { imageService } from "projects/service/image";
import { addToDecorGrid, decorContainsPoint, ensureDecorMetaGmRoomId, getDecorRect, isCollidable, localDecorGroupRegex, normalizeDecor, removeFromDecorGrid, verifyDecor } from "../service/geomorph";

import useStateRef from "../hooks/use-state-ref";
import GmsCanvas from "./GmsCanvas";

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

    initByRoom() {
      gms.forEach((gm, gmId) => {
        state.byRoom[gmId] = gm.gmRoomDecor;
        gm.gmRoomDecor.forEach(({ colliders, decor }) => {
          Object.assign(state.decor, decor);
          colliders.forEach(d => addToDecorGrid(d, getDecorRect(d), state.byGrid))
        });
      });
    },
    getDecorInRoom(gmId, roomId, onlyColliders = false) {
      const atRoom = state.byRoom[gmId][roomId];
      return onlyColliders
        ? atRoom.colliders // We exclude groups:
        : Object.values(atRoom?.decor || {}).filter(x => x.type !== 'group')
      ;
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
    removeDecor(decorKeys) {
      const ds = decorKeys.map(decorKey => state.decor[decorKey])
        // cannot remove read-only group or its items
        // .filter(d => d && !localDecorGroupRegex.test(d.key))
      ;
      if (!ds.length) {
        return;
      }

      ds.forEach(decor => {
        // removing group removes its children
        decor.type === 'group' && ds.push(...decor.items);
        // removing child (without removing parent) removes respective item from `items`
        if (decor.parentKey) {
          const parent = /** @type {NPC.DecorGroup} */ (state.decor[decor.parentKey]);
          parent.items.splice(parent.items.findIndex(item => item.key === decor.key), 1);
        }
      });

      // Assume all the decor we are deleting comes from the same room
      const gmId = /** @type {number} */ (ds[0].meta.gmId);
      const roomId = /** @type {number} */ (ds[0].meta.roomId);
      const atRoom = state.byRoom[gmId][roomId];

      ds.forEach(d => {
        delete state.decor[d.key];
        delete atRoom?.decor[d.key];
      });
      atRoom && (atRoom.colliders = atRoom.colliders.filter(d => !ds.includes(d)));

      // delete from decor grid
      ds.filter(isCollidable).forEach(d => removeFromDecorGrid(d, state.byGrid));

      // 🚧 `ds` could contain dups e.g. `decorKeys` could mention group & child
      api.npcs.events.next({ key: 'decors-removed', decors: ds });

      state.render();
    },
    setDecor(...ds) {
      for (const d of ds) {
        if (!d || !verifyDecor(d)) {
          throw Error(`invalid decor: ${JSON.stringify(d)}`);
        } else if (localDecorGroupRegex.test(d.key)) {
          throw Error(`read-only decor: ${JSON.stringify(d)}`);
        }
        if (state.decor[d.key]) {
          d.updatedAt = Date.now();
        }

        ensureDecorMetaGmRoomId(d, api);
        normalizeDecor(d);

        // Every decor must have meta.{gmId,roomId}, even DecorPath
        const gmId = /** @type {number} */ (d.meta.gmId);
        const roomId = /** @type {number} */ (d.meta.roomId);
        const atRoom = state.byRoom[gmId][roomId];

        atRoom.decor[d.key] = d;

        if (d.type === 'group') {
          d.items.forEach(child => {
            state.decor[child.key] = child;
            atRoom.decor[child.key] = child;
            if (isCollidable(child)) {
              atRoom.colliders.push(child);
              // Handle set without remove
              d.key in state.decor && removeFromDecorGrid(child, state.byGrid);
              addToDecorGrid(child, getDecorRect(child), state.byGrid);
            }
          });
        } else if (isCollidable(d)) {
          atRoom.colliders.push(d);
          d.key in state.decor && removeFromDecorGrid(d, state.byGrid);
          addToDecorGrid(d, getDecorRect(d), state.byGrid);
        }

        state.decor[d.key] = d;
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
        case 'group':
          // ℹ️ byRoom[gmId].decor closed under group descendants
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
    render() {
      const { ctxts } = state;

      gms.forEach((gm, gmId) => {
        const ctxt = ctxts[gmId];
        ctxt.resetTransform();
        ctxt.clearRect(0, 0, ctxt.canvas.width, ctxt.canvas.height);

        ctxt.transform(
          gmScale, 0, 0, gmScale,
          -gmScale * gm.pngRect.x, -gmScale * gm.pngRect.y,
        );
        ctxt.transform(...gm.inverseMatrix.toArray());

        state.byRoom[gmId].forEach(({ decor }, roomId) =>
          Object.values(decor).forEach(d => state.renderDecor(ctxt, d))
        );

      });
    },
  }));

  React.useEffect(() => {
    state.initByRoom();
    state.render();
    props.onLoad(state);
  }, []);

  return (
    <div
      className="decor-root"
      ref={el => el && (state.rootEl = el)}
      onClick={state.onClick}
    >
      <GmsCanvas
        gms={gms}
        scaleFactor={gmScale}
        canvasRef={(el, gmId) => state.ctxts[gmId] = assertNonNull(el.getContext('2d'))}
      />
    </div>
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
 * @property {import('./World').State} api
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
 * @property {(decorKeys: string[]) => void} removeDecor
 * Remove decor, all assumed to be in same room
 * @property {() => void} initByRoom
 * @property {(...decor: NPC.DecorDef[]) => void} setDecor
 * @property {(ctxt: CanvasRenderingContext2D, d: NPC.DecorDef) => void} renderDecor
 * @property {() => void} render
 */

/**
 * @typedef ToggleLocalDecorOpts
 * @property {Geomorph.GmRoomId[]} [added]
 * @property {Geomorph.GmRoomId[]} [removed]
 */
