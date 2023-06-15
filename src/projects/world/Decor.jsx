import React from "react";
import { css, cx } from "@emotion/css";
import { debounce } from "debounce";
import { assertDefined, testNever } from "../service/generic";
import { cssName } from "./const";
import { circleToCssStyles, pointToCssTransform, rectToCssStyles, cssStylesToCircle, cssTransformToPoint, cssStylesToRect } from "../service/dom";
import { geom } from "../service/geom";
import * as npcService from "../service/npc";
import { decorContainsPoint, ensureDecorMetaGmRoomId, extendDecorRect, getGmRoomKey, getLocalDecorGroupKey, metaToTags } from "../service/geomorph";

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
    byGmRoom: {},
    decor: {},
    groupCache: {},
    rootEl: /** @type {HTMLDivElement} */ ({}),
    ready: true,

    ensureRoomGroup(gmId, roomId) {
      const groupKey = getLocalDecorGroupKey(gmId, roomId);
      if (state.groupCache[groupKey]) {
        return state.groupCache[groupKey];
      }

      const { roomDecor: { [roomId]: roomDecor }, matrix } = api.gmGraph.gms[gmId];
      /** @type {NPC.DecorGroup} */
      const group = {
        key: getLocalDecorGroupKey(gmId, roomId),
        type: 'group',
        meta: { gmId, roomId },
        items: Object.values(roomDecor).map(d =>
          state.instantiateLocalDecor(d, gmId, roomId, matrix)
        ),
        cache: true,
      };
      state.normalizeDecor(group);
      return state.groupCache[group.key] = group;
    },
    getDecorAtKey(gmRoomKey) {
      return /** @type {(NPC.DecorCircle | NPC.DecorRect)[]} */ (Object.keys(state.byGmRoom[gmRoomKey] || {})
        .map(decorKey => state.decor[decorKey])
      );
    },
    getDecorAtPoint(point) {
      const result = api.gmGraph.findRoomContaining(point);
      if (result) {
        const gmRoomKey = getGmRoomKey(result.gmId, result.roomId);
        const closeDecor = state.getDecorAtKey(gmRoomKey);
        return closeDecor.filter(decor => decorContainsPoint(decor, point));
      } else {
        return [];
      }
    },
    handleDevToolEdit(els) {
      for (const el of els) {
        const decorKey = el.dataset.key || '';
        if (el.classList.contains(cssName.decorCircle)) {
          if (decorKey in state.decor) {
            const decor = /** @type {NPC.DecorDef & { type: 'circle'}} */ (state.decor[decorKey]);
            const output = cssStylesToCircle(el);
            if (output) {
              [decor.radius, decor.center] = [output.radius, output.center];
              triggerUpdate(decor);
            }
          }
        } else if (el.classList.contains(cssName.decorPath)) {
          const pathDecorKey = el.dataset.key || '';
          if (pathDecorKey in state.decor) {
            const decor = /** @type {NPC.DecorPath} */ (state.decor[pathDecorKey]);
            if (!decor.origPath) decor.origPath = decor.path.map(p => ({ x: p.x, y: p.y }));
            
            // devtool provides validation (Invalid property value)
            const matrix = new DOMMatrix(el.style.transform);
            decor.origPath.forEach((p, i) => {
              const { x, y } = matrix.transformPoint(p);
              [decor.path[i].x, decor.path[i].y] = [x, y];
            });

            if (matrix.isIdentity) delete decor.origPath;
            triggerUpdate(decor);
          }
        } else if (el.classList.contains(cssName.decorPathPoint)) {// from DecorPath
          const parentEl = /** @type {HTMLElement} */ (el.parentElement);
          const pathDecorKey = parentEl.dataset.key || '';
          if (pathDecorKey in state.decor) {
            const decor = /** @type {NPC.DecorPath} */ (state.decor[pathDecorKey]);
            const decorPoints = /** @type {HTMLDivElement[]} */ (
              Array.from(parentEl.querySelectorAll(`div.${cssName.decorPathPoint}`))
            );
            const points = decorPoints.map(x => cssTransformToPoint(x));
            if (points.every(x => x)) {
              decor.path.splice(0, decor.path.length, .../** @type {Geom.VectJson[]} */ (points));
              triggerUpdate(decor);
            }
          }
        } else if (el.classList.contains(cssName.decorPoint)) {
          if (decorKey in state.decor) {
            const decor = /** @type {NPC.DecorPoint} */ (state.decor[decorKey]);
            const output = cssTransformToPoint(el);
            if (output) {
              [decor.x, decor.y] = [output.x, output.y];
              triggerUpdate(decor);
            }
          }
        } else if (el.classList.contains(cssName.decorRect)) {
          if (decorKey in state.decor) {
            const decor = /** @type {NPC.DecorRect} */ (state.decor[decorKey]);
            const output = cssStylesToRect(el);
            if (output) {
              Object.assign(decor, /** @type {typeof decor} */ (output.baseRect));
              decor.angle = output.angle;
              extendDecorRect(decor);
              triggerUpdate(decor);
            }
          }
        } else if (el.classList.contains(cssName.decorGroup)) {
          // NOOP 
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
    instantiateLocalDecor(d, gmId, roomId, matrix) {
      /**
       * Override d.key now we know { gmId, roomId }.
       * Actually, children will be overwritten again later.
       */
      const key = `${getLocalDecorGroupKey(gmId, roomId)}-${d.key}`;

      if (d.type === 'rect') {
        // 🚧 better way of computing transformed angledRect?
        const transformedPoly = assertDefined(d.derivedPoly).clone().applyMatrix(matrix).fixOrientation();
        const { angle, baseRect } = geom.polyToAngledRect(transformedPoly);
        return {
          ...d,
          ...baseRect,
          key,
          angle,
          meta: {...d.meta},
        };
      } else if (d.type === 'circle') {
        return {
          ...d,
          key,
          center: matrix.transformPoint({ ...d.center }),
          meta: {...d.meta},
        };
      } else if (d.type === 'point') {
        return {
          ...d,
          key,
          ...matrix.transformPoint({ x: d.x, y: d.y }),
          meta: {
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
      switch (d.type) {
        case 'circle':
          ensureDecorMetaGmRoomId(d, api);
          break;
        case 'path':
          // Handle clones
          delete d.origPath;
          break;
        case 'point':
          ensureDecorMetaGmRoomId(d, api);
          // Extend meta with any tags provided in def; normalize tags
          d.tags?.forEach(tag => d.meta[tag] = true);
          d.tags = metaToTags(d.meta);
          break;
        case 'rect':
          extendDecorRect(d); // Add derived data
          ensureDecorMetaGmRoomId(d, api);
          break;
        case 'group': {
          ensureDecorMetaGmRoomId(d, api);
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
    removeDecor(...decorKeys) {
      const decors = decorKeys.map(decorKey => state.decor[decorKey]).filter(Boolean);
      decors.forEach(decor => {
        // removing group removes its children
        decor.type === 'group' && decors.push(...decor.items);
        // removing child (without removing parent) removes respective item from `items`
        if (decor.parentKey) {
          const parent = /** @type {NPC.DecorGroup} */ (state.decor[decor.parentKey]);
          parent.items.splice(parent.items.findIndex(item => item.key === decor.key), 1);
        }
      });
      decors.forEach(decor => {
        delete state.decor[decor.key];
        delete state.byGmRoom[getGmRoomKey(
          /** @type {number} */ (decor.meta.gmId),
          /** @type {number} */ (decor.meta.roomId),
        )]?.[decor.key];
      });
      // 🚧 decors can contain dups
      api.npcs.events.next({ key: 'decors-removed', decors });
      update();
    },
    setDecor(...decor) {
      for (const d of decor) {
        if (!d || !npcService.verifyDecor(d)) {
          throw Error(`invalid decor: ${JSON.stringify(d)}`);
        }
        if (state.decor[d.key]) {
          d.updatedAt = Date.now();
        }

        if (d.type === 'group') {
          if (state.groupCache[d.key]) {
            state.restoreGroup(d.key);
          } else {
            state.normalizeDecor(d);
            const gmRoomKey = getGmRoomKey(
              /** @type {number} */ (d.meta.gmId),
              /** @type {number} */ (d.meta.roomId),
            );
            state.byGmRoom[gmRoomKey] ||= {};
            d.items.forEach(child => {
              state.byGmRoom[gmRoomKey][child.key] = true;
              state.decor[child.key] = child;
            });

            if (d.cache && !state.groupCache[d.key]) {
              state.groupCache[d.key] = d;
            }
          }
        } else {
          state.normalizeDecor(d);
          // 🚧 would prefer every decor to have {gmId, roomId}, but DecorPath cannot
          if (typeof d.meta.gmId === 'number' && typeof d.meta.roomId === 'number') { 
            const gmRoomKey = getGmRoomKey(d.meta.gmId, d.meta.roomId);
            (state.byGmRoom[gmRoomKey] ||= {})[d.key] = true;
          }
        }

        state.decor[d.key] = d;
      }
      api.npcs.events.next({ key: 'decors-added', decors: decor });
      update();
    },
    restoreGroup(groupKey) {
      const group = state.groupCache[groupKey];
      const gmRoomKey = getGmRoomKey(// Assume cached groups have meta.{gmId,roomId}
        /** @type {number} */ (group.meta.gmId),
        /** @type {number} */ (group.meta.roomId),
      );
      state.decor[group.key] = group;
      (state.byGmRoom[gmRoomKey] ||= {})[group.key] = true;
      group.items.forEach(other => {
        state.decor[other.key] = other;
        state.byGmRoom[gmRoomKey][other.key] = true;
      });
    },
    update,
  }));

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  React.useEffect(() => {
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
      ref={el => el && (state.rootEl = el)}
      onClick={e => {
        const el = e.target;
        if (el instanceof HTMLDivElement && el.dataset.key) {
          const item = state.decor[el.dataset.key];
          api.npcs.events.next({ key: 'decor-click', decor: item });
        }
      }}
    >
      {Object.values(state.decor).filter(def => !def.parentKey).map((def) =>
        <MemoizedDecorInstance
          key={def.key}
          def={def}
          updatedAt={def.updatedAt}
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
    return (
      <div
        key={def.key}
        data-key={def.key}
        data-meta={JSON.stringify(def.meta)}
        className={cx(cssName.decorGroup, `gm-${def.meta.gmId}`)}
      >
        {def.items.map(item => <DecorInstance key={item.key} def={item} />)}
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
  /** Prevent descendent 'z-index: 1' ascension */
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
  position: absolute;
  border-radius: 50%;
  border: 2px dotted #ffffff55;
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

/** @param {Geomorph.PointMeta} meta */
function metaToIconClasses(meta) {
  if (meta.stand) return 'icon standing-person'; // 🚧 use const
  if (meta.sit) return 'icon sitting-silhouette';
  if (meta.lie) return 'icon lying-man-posture-silhouette';
  if (meta.label) return 'icon info-icon';
  return undefined;
}

const cssRect = css`
  position: absolute;
  transform-origin: left top;
  /* transform-origin: center; */
  border: 2px dotted #ffffff55;
`;

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
 * @property {Record<string, NPC.DecorGroup>} groupCache
 * @property {HTMLElement} rootEl
 * @property {Record<string, { [decorKey: string]: true }>} byGmRoom
 * Decor keys organised by gmRoomKey `g{gmId}-r{roomId}`.
 * @property {(gmRoomKey: string) => (NPC.DecorCircle | NPC.DecorRect)[]} getDecorAtKey
 * Get all decor in specified room `g{gmId}-r{roomId}`.
 * @property {(point: Geom.VectJson) => NPC.DecorDef[]} getDecorAtPoint
 * Get all decor in same room as point which intersects point.
 * @property {(els: HTMLElement[]) => void} handleDevToolEdit
 * @property {(d: NPC.DecorGroupItem, gmId: number, roomId: number, matrix: Geom.Mat) => NPC.DecorGroupItem} instantiateLocalDecor
 * @property {boolean} ready
 * @property {(d: NPC.DecorDef) => void} normalizeDecor
 * @property {(...decorKeys: string[]) => void} removeDecor
 * @property {(groupDecorKey: string) => void} restoreGroup
 * @property {(gmId: number, roomId: number) => NPC.DecorGroup} ensureRoomGroup
 * ensure room decor group is cached and return it
 * @property {(...decor: NPC.DecorDef[]) => void} setDecor
 * @property {() => void} update
 */
