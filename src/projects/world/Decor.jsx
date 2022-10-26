import React from "react";
import { css, cx } from "@emotion/css";
import { lineSegToCssTransform } from "../service/dom";
import DecorPath from "./DecorPath";

/** @param {{ item: NPC.DecorDef }} props  */
export default function Decor({ item }) {
  switch (item.type) {
    case 'path':
      return <DecorPath decor={item} />
    case 'circle':
      return (
        <div
          data-key={item.key}
          className={cx('debug-circle', cssCircle)}
          style={{
            transform: `translate(${item.center.x}px, ${item.center.y}px) scale(${2 * item.radius})`
          }}
        />
      );
    case 'seg':
      return (
        <div
          data-key={item.key}
          className={cx('debug-seg', cssSeg)}
          style={{
            transform: lineSegToCssTransform(item),
          }}
        />
      );
    default:
      console.error(`unexpected decor`, item);
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

const cssSeg = css`
  position: absolute;
  /* z-index: 1; */
  width: 1px;
  border-top: 1px solid green;
  transform-origin: left top;
`;
