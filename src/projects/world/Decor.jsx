import React from "react";
import { css, cx } from "@emotion/css";
import { testNever } from "../service/generic";
import { cssName } from "../service/const";
import { circleToCssTransform, pointToCssTransform, rectToCssTransform } from "../service/dom";
import DecorPath from "./DecorPath";

/**
 * @param {{ decor: import('./NPCs').State['decor']; api: import('./World').State; }} props
 */
export default function Decor({ decor, api }) {
  return (
    <div className="decor-root">
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
  background-color: #6666ff88;
`;
