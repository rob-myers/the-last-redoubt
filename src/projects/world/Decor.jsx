import React from "react";
import { css, cx } from "@emotion/css";
import { testNever } from "../service/generic";
import { cssName } from "../service/const";
import { circleToCssTransform, lineSegToCssTransform, pointToCssTransform } from "../service/dom";
import DecorPath from "./DecorPath";

/** @param {{ item: NPC.DecorDef }} props  */
export default function Decor({ item }) {
  switch (item.type) {
    case 'circle':
      return (
        <div
          data-key={item.key}
          className={cx(cssName.decorCircle, cssCircle)}
          style={{
            transform: circleToCssTransform(item),
          }}
        />
      );
    case 'path':
      return (
        <DecorPath decor={item} />
      );
    case 'point':
      return (
        <div
          data-key={item.key}
          className={cx(cssName.decorPoint, cssPoint)}
          onClick={item.onClick ? () => item.onClick?.(item) : undefined}
          style={{
            transform: pointToCssTransform(item),
            cursor: item.onClick ? 'pointer' : 'initial',
          }}
        />
      );
    case 'seg':
      return (
        <div
          data-key={item.key}
          className={cx(cssName.decorSeg, cssSeg)}
          style={{
            transform: lineSegToCssTransform(item),
          }}
        />
      );
    default:
      console.error(testNever(item, { override: `unexpected decor: ${JSON.stringify(item)}` }));
      // throw testNever(item);
      return null;
  }
}

const cssCircle = css`
  position: absolute;
  background-color: #ff444488;
  width: 1px;
  height: 1px;
  transform-origin: center;
  border-radius: 50%;
`;

const cssPoint = css`
  position: absolute;
  background-color: #0f0;
  width: 5px;
  height: 5px;
  transform-origin: center;
  border-radius: 50%;
`;

const cssSeg = css`
  position: absolute;
  /* z-index: 1; */
  width: 1px;
  border-top: 1px solid green;
  transform-origin: left top;
`;
