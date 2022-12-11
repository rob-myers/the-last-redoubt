import React from "react";
import { css, cx } from "@emotion/css";
import { debounce } from "debounce";
import { testNever } from "../service/generic";
import { cssName } from "../service/const";
import { circleToCssTransform, pointToCssTransform, rectToCssTransform, cssTransformToCircle, cssTransformToPoint, cssTransformToRect } from "../service/dom";

import useUpdate from "../hooks/use-update";
import DecorPath from "./DecorPath";

/**
 * @param {Props} props
 */
export default function Decor({ decor, api }) {
  const update = useUpdate();

  React.useEffect(() => {
    const { npcs } = api;
    const observer = new MutationObserver(debounce((records) => {
      // console.log({records});
      const els = records.map(x => /** @type {HTMLElement} */ (x.target));

      for (const el of els) {
        const decorKey = el.dataset.key;
        if (el.classList.contains(cssName.decorCircle)) {
          if (decorKey && decorKey in npcs.decor) {
            const decor = /** @type {NPC.DecorDef & { type: 'circle'}} */ (npcs.decor[decorKey]);
            const { center, radius } = cssTransformToCircle(el);
            [decor.radius, decor.center] = [radius, center];
            update();
          }
        }
        if (el.classList.contains(cssName.decorPath)) {
          const pathDecorKey = el.dataset.key;
          if (pathDecorKey && pathDecorKey in npcs.decor) {
            const decor = /** @type {NPC.DecorPath} */ (npcs.decor[pathDecorKey]);
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
          if (pathDecorKey && pathDecorKey in npcs.decor) {// Path
            const decor = /** @type {NPC.DecorPath} */ (npcs.decor[pathDecorKey]);
            const decorPoints = /** @type {HTMLDivElement[]} */ (Array.from(parentEl.querySelectorAll(`div.${cssName.decorPoint}`)));
            const points = decorPoints.map(x => cssTransformToPoint(x));
            decor.path.splice(0, decor.path.length, ...points);
            update();
          } else if (decorKey && decorKey in npcs.decor) {
            const decor = /** @type {NPC.DecorPoint} */ (npcs.decor[decorKey]);
            const { x, y } = cssTransformToPoint(el);
            [decor.x, decor.y] = [x, y];
            update();
          }
        }
        if (el.classList.contains(cssName.decorRect)) {
          if (decorKey && decorKey in npcs.decor) {
            const decor = /** @type {NPC.DecorDef & { type: 'rect' }} */ (npcs.decor[decorKey]);
            const rectJson = cssTransformToRect(el);
            Object.assign(decor, rectJson);
            update();
          }
        }
      }
    }, 300));

    observer.observe(npcs.decorEl, { attributes: true, attributeFilter: ['style'], subtree: true });
    return () => observer.disconnect();
  }, [api.npcs]);

  return (
    <div
      className="decor-root"
      ref={el => el && (api.npcs.decorEl = el)}
    >
      {Object.entries(decor).map(([key, item]) => {
        switch (item.type) {
          case 'circle':
            return (
              <div
                key={key}
                data-key={item.key}
                className={cx(cssName.decorCircle, cssCircle)}
                style={{
                  transform: circleToCssTransform(item),
                }}
              />
            );
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
                key={key}
                data-key={item.key}
                className={cx(cssName.decorPoint, cssPoint)}
                onClick={item.onClick ? () => item.onClick?.(item, api) : undefined}
                style={{
                  transform: pointToCssTransform(item),
                  cursor: item.onClick ? 'pointer' : 'initial',
                }}
              />
            );
          case 'rect':
            return (
              <div
                key={key}
                data-key={item.key}
                data-tags="no-ui"
                className={cx(cssName.decorRect, cssRect)}
                style={{
                  transform: rectToCssTransform(item),
                }}
              />
            );
          default:
            console.error(testNever(item, { override: `unexpected decor: ${JSON.stringify(item)}` }));
            return null;
        }
      })}
    </div>
  );
}

const cssCircle = css`
  position: absolute;
  width: 1px;
  height: 1px;
  transform-origin: center;
  border-radius: 50%;
  background-color: #ff444488;
`;

const cssPoint = css`
  position: absolute;
  width: 5px;
  height: 5px;
  transform-origin: center;
  border-radius: 50%;
  background-color: #fff;
  outline: 1px solid rgba(0, 100, 0, 0.5);
`;

const cssRect = css`
  position: absolute;
  width: 1px;
  height: 1px;
  transform-origin: left top;
  background-color: #7700ff22;
`;

/**
 * @typedef Props
 * @property {import('./NPCs').State['decor']} decor
 * @property {import('./World').State} api
 */
