import React from "react";
import { css, cx } from "@emotion/css";
import { debounce } from "debounce";
import { testNever } from "../service/generic";
import { cssName } from "../service/const";
import { circleToCssStyles, pointToCssTransform, rectToCssStyles, cssStylesToCircle, cssTransformToPoint, cssStylesToRect } from "../service/dom";
import * as npcService from "../service/npc";

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
    decor: {},
    decorEl: /** @type {HTMLDivElement} */ ({}),
    handleDevToolEdit(els) {
      for (const el of els) {
        const decorKey = el.dataset.key;
        if (el.classList.contains(cssName.decorCircle)) {
          if (decorKey && decorKey in state.decor) {
            const decor = /** @type {NPC.DecorDef & { type: 'circle'}} */ (state.decor[decorKey]);
            const output = cssStylesToCircle(el);
            if (output) {
              [decor.radius, decor.center] = [output.radius, output.center]
              update();
            }
          }
        }
        if (el.classList.contains(cssName.decorPath)) {
          const pathDecorKey = el.dataset.key;
          if (pathDecorKey && pathDecorKey in state.decor) {
            const decor = /** @type {NPC.DecorPath} */ (state.decor[pathDecorKey]);
            if (!decor.origPath) decor.origPath = decor.path.map(p => ({ x: p.x, y: p.y }));
            
            // devtool provides validation (Invalid property value)
            const matrix = new DOMMatrix(el.style.transform);
            decor.origPath.forEach((p, i) => {
              const { x, y } = matrix.transformPoint(p);
              [decor.path[i].x, decor.path[i].y] = [x, y];
            });

            if (matrix.isIdentity) delete decor.origPath;
            update();
          }
        }
        if (el.classList.contains(cssName.decorPoint)) {
          const parentEl = /** @type {HTMLElement} */ (el.parentElement);
          const pathDecorKey = parentEl.dataset.key;
          if (pathDecorKey && pathDecorKey in state.decor) {// Path
            const decor = /** @type {NPC.DecorPath} */ (state.decor[pathDecorKey]);
            const decorPoints = /** @type {HTMLDivElement[]} */ (Array.from(parentEl.querySelectorAll(`div.${cssName.decorPoint}`)));
            const points = decorPoints.map(x => cssTransformToPoint(x));
            if (points.every(x => x)) {
              decor.path.splice(0, decor.path.length, .../** @type {Geom.VectJson[]} */ (points));
              decor.devtoolTransform = el.style.transform;
              update();
            }
          } else if (decorKey && decorKey in state.decor) {
            const decor = /** @type {NPC.DecorPoint} */ (state.decor[decorKey]);
            const output = cssTransformToPoint(el);
            if (output) {
              [decor.x, decor.y] = [output.x, output.y];
              decor.devtoolTransform = el.style.transform;
              update();
            }
          }
        }
        if (el.classList.contains(cssName.decorRect)) {
          if (decorKey && decorKey in state.decor) {
            const decor = /** @type {NPC.DecorDef & { type: 'rect' }} */ (state.decor[decorKey]);
            const output = cssStylesToRect(el);
            if (output) {
              Object.assign(decor, /** @type {typeof decor} */ (output.baseRect));
              decor.angle = output.angle;
              update();
            }
          }
        }
      }
    },
    ready: true,
    removeDecor(...decorKeys) {
      const decors = decorKeys.map(decorKey => api.decor.decor[decorKey]).filter(Boolean);
      decors.forEach(decor => delete api.decor.decor[decor.key]);
      api.npcs.events.next({ key: 'decors-removed', decors });
      update();
    },
    setDecor(...decor) {
      for (const d of decor) {
        if (!d || !npcService.verifyDecor(d)) {
          throw Error(`invalid decor: ${JSON.stringify(d)}`);
        }
        if (api.decor.decor[d.key]) {
          d.updatedAt = Date.now();
        }
        switch (d.type) {
          case 'path': // Handle clones
            delete d.origPath;
            break;
          case 'point':
            // Ensure tags and meta extending tags
            (d.tags ??= []) && (d.meta ??= {}) && d.tags.forEach(tag => d.meta[tag] = true);
            break;
        }
        api.decor.decor[d.key] = d;
      }
      api.npcs.events.next({ key: 'decors-added', decors: decor });
      update();
    },
    update,
  }));

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  React.useEffect(() => {
    const observer = new MutationObserver(debounce((records) => {
      // console.log({records});
      const els = records.map(x => /** @type {HTMLElement} */ (x.target));
      state.handleDevToolEdit(els);
    }, 300));

    observer.observe(state.decorEl, {
      attributes: true,
      attributeFilter: ['style'],
      subtree: true,
    });
    return () => observer.disconnect();
  }, [api.npcs.ready]);

  return (
    <div
      className={cx("decor-root", rootCss)}
      ref={el => el && (state.decorEl = el)}
      onClick={e => {
        const el = e.target;
        if (el instanceof HTMLDivElement && el.dataset.key) {
          const item = state.decor[el.dataset.key];
          api.npcs.events.next({ key: 'decor-click', decor: item });
        }
      }}
    >
      {Object.entries(state.decor).map(([key, item]) => {
        switch (item.type) {
          case 'circle': {
            const { top, left, width } = circleToCssStyles(item);
            return (
              <div
                key={key}
                data-key={item.key}
                className={cx(cssName.decorCircle, cssCircle)}
                style={{
                  left,
                  top,
                  width,
                  height: width,
                }}
              />
            );
          }
          case 'path':
            return (
              <DecorPath
                key={key}
                decor={item}
              />
            );
          case 'point':
            return (
              <div
                key={item.key}
                data-key={item.key}
                data-meta={JSON.stringify(item.meta)}
                className={cx(
                  cssName.decorPoint,
                  cssPoint,
                  metaToIconClasses(item.meta),
                )}
                style={{
                  transform: pointToCssTransform(item),
                }}
              />
            );
          case 'rect': {
            const { top, left, width, height, transform } = rectToCssStyles(item);
            return (
              <div
                key={key}
                data-key={item.key}
                data-meta={JSON.stringify({ 'decor-rect': true })}
                className={cx(cssName.decorRect, cssRect)}
                style={{
                  left,
                  top,
                  width,
                  height,
                  transform,
                }}
              />
            );
        }
          default:
            console.error(testNever(item, { override: `unexpected decor: ${JSON.stringify(item)}` }));
            return null;
        }
      })}
    </div>
  );
}

const rootCss = css`
  position: absolute;
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
  background-color: #ff444488;
`;

const cssPoint = css`
  ${cssName.decorIconWidth}: 5px;

  position: absolute;
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
    transition: transform 300ms ease-in-out, opacity 500ms ease-in-out;
  }

  &.icon:hover::after {
    transform: scale(1.75);
    opacity: 1;
  }
  //#endregion icon
  
`;

/** @param {Geomorph.PointMeta} meta */
function metaToIconClasses(meta) {
  if (meta.stand) return 'icon standing-person';
  if (meta.sit) return 'icon sitting-silhouette';
  if (meta.lie) return 'icon lying-man-posture-silhouette';
  return undefined;
}

const cssRect = css`
  position: absolute;
  transform-origin: left top;
  /* transform-origin: center; */
  background-color: #7700ff22;
`;

/**
 * @typedef Props
 * @property {import('./World').State} api
 * @property {(api: State) => void} onLoad
 */

/**
 * @typedef State @type {object}
 * @property {Record<string, NPC.DecorDef>} decor
 * @property {HTMLElement} decorEl
 * @property {(els: HTMLElement[]) => void} handleDevToolEdit
 * @property {boolean} ready
 * @property {(...decorKeys: string[]) => void} removeDecor
 * @property {(...decor: NPC.DecorDef[]) => void} setDecor
 * @property {() => void} update
 */
