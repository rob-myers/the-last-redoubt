import React from "react";
import { css, cx } from "@emotion/css";
import { debounce } from "debounce";
import { cssName } from "./const";
import { error } from "../service/log";
import { assertDefined, testNever } from "../service/generic";
import { circleToCssStyles, pointToCssTransform, rectToCssStyles, cssStylesToCircle, cssTransformToPoint, cssStylesToRect, cssStylesToPoint } from "../service/dom";
import { geom } from "../service/geom";
import { addToDecorGrid, decorContainsPoint, ensureDecorMetaGmRoomId, extendDecor, getDecorRect, getLocalDecorGroupKey, isCollidable, localDecorGroupRegex, metaToTags, removeFromDecorGrid, verifyDecor } from "../service/geomorph";
import { npcService } from "../service/npc";

import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import DecorPath from "./DecorPath";

/**
 * @param {Props} props
 */
export default function Decor(props) {
  const { api } = props;
  const update = useUpdate();

  const state = useStateRef(/** @type {() => State} */ () => ({
    byGrid: [],
    byRoom: api.gmGraph.gms.map(_ => []),
    decor: {},
    visible: {},
    rootEl: /** @type {HTMLDivElement} */ ({}),
    ready: true,

    ensureByRoom(gmId, roomId) {
      let atRoom = state.byRoom[gmId][roomId];

      if (!atRoom) {// Build read-only named-groups 'symbol' and 'door'
        const gm = api.gmGraph.gms[gmId];
        const { roomDecor: { [roomId]: base }, matrix } = gm;

        atRoom = state.byRoom[gmId][roomId] = {
          symbol: { key: getLocalDecorGroupKey('symbol', gmId, roomId), type: 'group', meta: { gmId, roomId }, items: [] },
          door: { key: getLocalDecorGroupKey('door', gmId, roomId), type: 'group', meta: { gmId, roomId }, items: [] },
          decor: {},
          colliders: [],
        };
        atRoom.symbol.items = base.symbol.items.map(d => state.instantiateLocalDecor(d, base.symbol, matrix));
        atRoom.door.items = base.door.items.map(d => state.instantiateLocalDecor(d, base.door, matrix));

        [atRoom.door, atRoom.symbol].forEach(group => {
          state.normalizeDecor(group);
          state.decor[group.key] = group;
          atRoom.decor[group.key] = group;
          group.items.forEach(child => {
            state.decor[child.key] = child;
            atRoom.decor[child.key] = child;
            if (isCollidable(child)) {
              atRoom.colliders.push(child);
              addToDecorGrid(child, getDecorRect(child), state.byGrid);
            }
          });
        });
      }

      return atRoom;
    },
    getDecorAtKey(gmId, roomId, onlyColliders = false) {
      const atRoom = state.byRoom[gmId][roomId];
      return onlyColliders
        ? atRoom.colliders // We exclude groups:
        : Object.values(atRoom?.decor || {}).filter(x => x.type !== 'group');
    },
    getDecorAtPoint(point) {
      const result = api.gmGraph.findRoomContaining(point);
      if (result) {
        const closeDecor = state.getDecorAtKey(result.gmId, result.roomId);
        return closeDecor.filter(decor => decorContainsPoint(decor, point));
      } else {
        return [];
      }
    },
    handleDevToolEdit(els) {
      for (const el of els.filter(el => el.dataset.key)) {
        const decorKey = /** @type {string} */ (el.dataset.key);

        // ℹ️ We don't handle DecorPath because mutating navPath breaks navMetas
        if (el.classList.contains(cssName.decorCircle)) {
          const decor = /** @type {NPC.DecorCircle} */ (state.decor[decorKey]);
          const output = cssStylesToCircle(el);
          if (output) {
            [decor.radius, decor.center] = [output.radius, output.center];
            triggerUpdate(decor);
          }
        } else if (el.classList.contains(cssName.decorPoint)) {
          const decor = /** @type {NPC.DecorPoint} */ (state.decor[decorKey]);
          const output = cssTransformToPoint(el);
          if (output) {
            [decor.x, decor.y] = [output.x, output.y];
            triggerUpdate(decor);
          }
        } else if (el.classList.contains(cssName.decorRect)) {
          const decor = /** @type {NPC.DecorRect} */ (state.decor[decorKey]);
          const output = cssStylesToRect(el);
          if (output) {
            Object.assign(decor, /** @type {NPC.DecorRect} */ (output.baseRect));
            decor.angle = output.angle;
            extendDecor(decor, api);
            triggerUpdate(decor);
          }
        } else if (el.classList.contains(cssName.decorGroupHandle)) {
          const decor = /** @type {NPC.DecorGroup} */ (state.decor[decorKey]);
          const point = cssStylesToPoint(el);
          if (point && decor.derivedHandlePos) {
            // update derivedHandlePos and items
            const delta = point.clone().sub(decor.derivedHandlePos);
            decor.derivedHandlePos = point;
            decor.items.forEach(d => {
              switch (d.type) {
                case 'circle':
                  d.center.x += delta.x;
                  d.center.y += delta.y;
                  break;
                case 'point':
                  d.x += delta.x;
                  d.y += delta.y;
                  break;
                case 'rect':
                  d.x += delta.x;
                  d.y += delta.y;
                  extendDecor(d, api);
                  break;
              }
              triggerUpdate(d);
            });
            triggerUpdate(decor);
          }
        }
      }

      /** @param {NPC.DecorDef} decor */
      function triggerUpdate(decor) {
        decor.updatedAt = Date.now();
        const parent = decor.parentKey ? state.decor[decor.parentKey] ?? null : null;
        parent && (parent.updatedAt = decor.updatedAt)
        update();
      }
    },
    instantiateLocalDecor(d, parent, matrix) {
      /**
       * Override d.key now we know { gmId, roomId }.
       * Actually, children will be overwritten again later.
       */
      const key = `${parent.key}-${d.key}`;

      if (d.type === 'rect') {
        // 🚧 better way of computing transformed angledRect?
        const transformedPoly = assertDefined(d.derivedPoly).clone().applyMatrix(matrix).fixOrientation();
        const { angle, baseRect } = geom.polyToAngledRect(transformedPoly);
        return {
          ...d,
          ...baseRect,
          key,
          angle,
          // parent.meta provides e.g. gmId
          meta: {...parent.meta, ...d.meta},
        };
      } else if (d.type === 'circle') {
        return {
          ...d,
          key,
          center: matrix.transformPoint({ ...d.center }),
          meta: {...parent.meta, ...d.meta},
        };
      } else if (d.type === 'point') {
        return {
          ...d,
          key,
          ...matrix.transformPoint({ x: d.x, y: d.y }),
          meta: {
            ...parent.meta,
            ...d.meta,
            // 🚧 cache?
            orient: typeof d.meta.orient === 'number'
              ? Math.round(matrix.transformAngle(d.meta.orient * (Math.PI / 180)) * (180 / Math.PI))
              : null,
            ui: true,
          },
        };
      } else {
        throw testNever(d, { suffix: 'instantiateDecor' });
      }
    },
    normalizeDecor(d) {
      ensureDecorMetaGmRoomId(d, api);
      switch (d.type) {
        case 'circle':
          break;
        case 'path':
          delete d.origPath; // Handle clones
          break;
        case 'point':
          // Extend meta with any tags provided in def; normalize tags
          d.tags?.forEach(tag => d.meta[tag] = true);
          d.tags = metaToTags(d.meta);
          break;
        case 'rect':
          extendDecor(d, api); // Add derived data
          break;
        case 'group': {
          extendDecor(d, api);
          return d.items.flatMap((item, index) => {
            item.parentKey = d.key;
            item.key = `${d.key}-${index}`; // Overwrite child keys
            state.normalizeDecor(item);
          });
        }
        default:
          throw testNever(d);
      }
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
        delete state.visible[d.key];
        delete atRoom?.decor[d.key];
      });
      Object.values(state.visible).forEach(d => {
        if (d.type === 'group' && d.meta.gmId === gmId && d.meta.roomId === roomId) {
          d.updatedAt = Date.now(); // Update visible groups in current room
        }
      });
      atRoom && (atRoom.colliders = atRoom.colliders.filter(d => !ds.includes(d)));

      // delete from decor grid
      ds.filter(isCollidable).forEach(d => removeFromDecorGrid(d, state.byGrid));

      // 🚧 `ds` could contain dups e.g. `decorKeys` could mention group & child
      api.npcs.events.next({ key: 'decors-removed', decors: ds });

      update();
    },
    rootRef(el) {
      if (el) {
        state.rootEl = el;
        // Styles permits getPropertyValue (vs CSS and getComputedStyle)
        !props.api.decor.ready && [
          cssName.decorCollidersDisplay,
        ].forEach(cssVarName =>
          el.style.setProperty(cssVarName, 'none')
        );
      }
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

        state.normalizeDecor(d);

        // Every decor must have meta.{gmId,roomId}, even DecorPath
        const gmId = /** @type {number} */ (d.meta.gmId);
        const roomId = /** @type {number} */ (d.meta.roomId);
        const atRoom = state.ensureByRoom(gmId, roomId);

        // Although DecorPath has meta.{gmId,roomId} do not cache by room
        d.type !== 'path' && (atRoom.decor[d.key] = d);
        (d.type === 'group' || !d.parentKey) && (state.visible[d.key] = d);

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
      update();
    },
    setPseudoDecor(...pseudoDecors) {
      /** @type {NPC.DecorDef[]} */
      const ds = pseudoDecors.map(pd => {
        if (npcService.verifyGlobalNavPath(pd)) {
          return {
            type: 'path',
            key: pd.name ?? 'navpath-default', // navpath is "in" room it starts in:
            meta: { ...pd.path.length && pd.gmRoomIds[0] },
            path: pd.path,
          };
        }
        return pd;
      });
      state.setDecor(...ds);
    },
    update,
    updateVisibleDecor(opts) {
      opts.added?.forEach(({ gmId, roomId }) => {
        try {
          const { decor } = api.decor.ensureByRoom(gmId, roomId);
          Object.values(decor)
            // `visible` contains groups and items not in any group (e.g. a DecorPath)
            .filter(d => d.type === 'group' || !d.parentKey)
            .forEach(d => state.visible[d.key] = d);
        } catch (e) {
          error(`updateLocalDecor: ensureByRoom: ${e}`);
        }
      });
      opts.removed?.forEach(({ gmId, roomId }) => {
        const { decor } = api.decor.ensureByRoom(gmId, roomId);
        Object.values(decor)
          .filter(d => d.type === 'group' || (!d.parentKey && d.type !== 'path'))
          .forEach(group => delete state.visible[group.key]);
      });

      update();
    },
  }));

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  React.useEffect(() => {// Handle devtool edits of point/rect/circle/group 
    const observer = new MutationObserver(debounce((records) => {
      const els = records.map(x => /** @type {HTMLElement} */ (x.target));
      state.handleDevToolEdit(els);
    }, 300));

    observer.observe(state.rootEl, {
      attributes: true,
      attributeFilter: ['style'],
      subtree: true,
    });
    return () => observer.disconnect();
  }, [api.npcs.ready]);

  return (
    <div
      className={cx("decor-root", rootCss)}
      ref={state.rootRef}
      onClick={state.onClick}
    >
      {Object.values(state.visible).map((d) =>
        <MemoizedDecorInstance
          key={d.key}
          def={d}
          updatedAt={d.updatedAt}
        />
      )}
    </div>
  );
}

/**
 * @param {DecorInstanceProps} _
 */
function DecorInstance({ def }) {
  if (def.type === 'circle') {
    const { top, left, width } = circleToCssStyles(def);
    return (
      <div
        key={def.key}
        data-key={def.key}
        data-meta={JSON.stringify(def.meta)}
        className={cx(cssName.decorCircle, cssCircle, `gm-${def.meta.gmId}`)}
        style={{
          left,
          top,
          width,
          height: width,
        }}
      />
    );
  } else if (def.type === 'group') {
    const handlePos = def.derivedHandlePos;
    return (
      <div
        key={def.key}
        data-key={def.key}
        data-meta={JSON.stringify(def.meta)}
        className={cx(cssName.decorGroup, cssGroup, `gm-${def.meta.gmId}`)}
      >
        {def.items.map(item => <DecorInstance key={item.key} def={item} />)}
        {handlePos && (
          <div
            className={cssName.decorGroupHandle}
            data-key={def.key}
            style={{ left: handlePos.x, top: handlePos.y }}
          />
        )}
      </div>
    );
  } else if (def.type === 'path') {
    return <DecorPath key={def.key} decor={def} />;
  } else if (def.type === 'point') {
    return (
      <div
        key={def.key}
        data-key={def.key}
        data-meta={JSON.stringify(def.meta)}
        className={cx(
          cssName.decorPoint,
          cssPoint,
          metaToIconClasses(def.meta),
          `gm-${def.meta.gmId}`,
        )}
        style={{
          transform: pointToCssTransform(def),
        }}
        {...decorPointHandlers}
      />
    );
  } else if (def.type === 'rect') {
    const { top, left, width, height, transform } = rectToCssStyles(def, def.angle ?? 0);
    return (
      <div
        key={def.key}
        data-key={def.key}
        data-meta={JSON.stringify(def.meta)}
        className={cx(cssName.decorRect, cssRect, `gm-${def.meta.gmId}`)}
        style={{
          left,
          top,
          width,
          height,
          transform,
          // transformOrigin: 'top left', // 👈 must have this value
        }}
      />
    );
  } else {
    console.error(testNever(def, { override: `unexpected decor: ${JSON.stringify(def)}` }));
    return null;
  }
}

/** @type {React.MemoExoticComponent<(props: DecorInstanceProps & { updatedAt?: number }) => JSX.Element | null>} */
const MemoizedDecorInstance = React.memo(DecorInstance);

const rootCss = css`
  position: absolute;
  /** Prevent descendant 'z-index: 1' ascension */
  z-index: 0;
  pointer-events: all;
  canvas {
    position: absolute;
    pointer-events: none;
  }
  svg {
    position: absolute;
    pointer-events: none;
  }
`;

const cssCircle = css`
  display: var(${cssName.decorCollidersDisplay});
  position: absolute;
  border-radius: 50%;
  border: 1px dashed #ffffff33;
`;

const cssGroup = css`
  .${cssName.decorGroupHandle} {
    position: absolute;
    width: 2px;
    height: 2px;
    background: white;
  }
`;

const cssPoint = css`
  ${cssName.decorIconWidth}: 5px;

  position: absolute;
  /** Above DecorPath */
  z-index: 1;
  top: calc(-0.5 * var(${cssName.decorIconWidth}));
  left: calc(-0.5 * var(${cssName.decorIconWidth}));
  width: var(${cssName.decorIconWidth});
  height: var(${cssName.decorIconWidth});
  pointer-events: all;
  cursor: pointer;

  border-radius: 50%;
  border: 0.5px solid #00000066;
  &.icon {
    border: none;
  }

  //#region icon
  display: flex;
  justify-content: center;
  align-items: center;

  &.icon::after {
    content: '';
    display: block;
    position: absolute;
    
    background-size: var(${cssName.iconSizeTiny}) var(${cssName.iconSizeTiny});
    height: var(${cssName.iconSizeTiny});
    width: var(${cssName.iconSizeTiny});
    
    filter: invert(1);
    background-color: #fff;
    border: 1.5px solid #fff;
    border-radius: 50%;
    outline: 0.5px solid black;
    opacity: 0.25;
    transform: scale(1);
    /* transition: transform 300ms ease-in-out, opacity 500ms ease-in-out; */
  }

  /* &.icon:hover::after {
    transform: scale(1.75);
    opacity: 1;
  } */
  //#endregion icon
`;

const cssRect = css`
  display: var(${cssName.decorCollidersDisplay});
  position: absolute;
  transform-origin: left top;
  /* transform-origin: center; */
  border: 1px dashed #ffffff33;
`;

/** @param {Geomorph.PointMeta} meta */
function metaToIconClasses(meta) {
  if (meta.stand) return 'icon standing-person'; // 🚧 use const
  if (meta.sit) return 'icon sitting-silhouette';
  if (meta.lie) return 'icon lying-man-posture-silhouette';
  if (meta.label) return 'icon info-icon';
  return undefined;
}

/**
 * Would prefer &.icon:hover::after but touch devices remain hovered,
 * obscuring npc when faded, or leaving white circular border underneath them.
 */
const decorPointHandlers = {
  onPointerOver: /** @param {React.PointerEvent<HTMLDivElement>} e */ (e) => {
    e.currentTarget.animate([{ offset: 0 }, { offset: 1, opacity: 1, transform: 'scale(1.75)' }], { duration: 1000, pseudoElement: '::after', fill: 'forwards' });
  },
  onPointerOut: /** @param {React.PointerEvent<HTMLDivElement>} e */ (e) => {
    e.currentTarget.animate([{ offset: 0 }, { offset: 1, opacity: 0.25, transform: 'scale(1)' }], { duration: 1000, pseudoElement: '::after', fill: 'forwards' });
  },
  onClick: /** @param {React.MouseEvent<HTMLDivElement>} e */ (e) => {
    e.currentTarget.animate([{ offset: 0 }, { offset: 0.25, opacity: 1, transform: 'scale(1.75)' }, { offset: 1, opacity: 0.25, transform: 'scale(1)' }], { duration: 3000, pseudoElement: '::after', fill: 'forwards' });
  },
};

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
 * @typedef State @type {object}
 * @property {Record<string, NPC.DecorDef>} decor
 * All decor, including children of groups.
 * @property {Record<string, NPC.DecorDef>} visible
 * Visible decor, organised as groups and items not in any group (e.g. a DecorPath)
 * @property {HTMLElement} rootEl
 * @property {NPC.DecorGrid} byGrid
 * Collidable decors in global grid where `byGrid[x][y]` covers the square:
 * (x * decorGridSize, y * decorGridSize, decorGridSize, decorGridSize)
 * @property {RoomDecorCache[][]} byRoom
 * Decor organised by `byRoom[gmId][roomId]`.
 * @property {(gmId: number, roomId: number, onlyColliders?: boolean) => NPC.DecorDef[]} getDecorAtKey
 * Get all decor in specified room.
 * @property {(point: Geom.VectJson) => NPC.DecorDef[]} getDecorAtPoint
 * Get all decor in same room as point which intersects point.
 * @property {(els: HTMLElement[]) => void} handleDevToolEdit
 * @property {(d: NPC.DecorGroupItem, parent: NPC.DecorGroup, matrix: Geom.Mat) => NPC.DecorGroupItem} instantiateLocalDecor
 * @property {boolean} ready
 * @property {(d: NPC.DecorDef) => void} normalizeDecor
 * @property {(e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void} onClick
 * @property {(decorKeys: string[]) => void} removeDecor
 * Remove decor, all assumed to be in same room
 * @property {(el: HTMLDivElement) => void} rootRef
 * @property {(gmId: number, roomId: number) => RoomDecorCache} ensureByRoom
 * Ensure room decor resides in
 * - `decor`
 * - `byRoom[gmId][roomId]`
 * @property {(...decor: NPC.DecorDef[]) => void} setDecor
 * @property {(...pseudoDecors: NPC.PseudoDecor[]) => void} setPseudoDecor
 * @property {() => void} update
 * @property {(opts: ToggleLocalDecorOpts) => void} updateVisibleDecor
 */

/**
 * @typedef ToggleLocalDecorOpts
 * @property {Graph.GmRoomId[]} [added]
 * @property {Graph.GmRoomId[]} [removed]
 */

/**
 * @typedef RoomDecorCache
 * @property {NPC.DecorGroup} symbol Named read-only group
 * @property {NPC.DecorGroup} door Named read-only group
 * @property {Record<string, NPC.DecorDef>} decor Everything in room
 * @property {NPC.DecorCollidable[]} colliders All colliders in room
 */
