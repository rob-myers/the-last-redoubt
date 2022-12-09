import React from "react";
import { css, cx } from "@emotion/css";

import { Rect } from "../geom";
import { cssName } from "../service/const";

/**
 * Path whose node positions are editable via chrome devtool.
 * We'll detect, mutate props (i.e. decor def), and re-render
 * @param {PathProps} props 
 */
export default function DecorPath({ decor }) {

  /** `origPath` defined iff root el has style.transform */
  const decorPath = decor.origPath??decor.path;
  // 🚧 avoid needless ancestral re-renders
  const aabb = Rect.fromPoints(...decorPath);

  return (
    <div
      // Remount clears user-specified `el.style.transform`
      key={decor.updatedAt}
      data-key={decor.key}
      className={cx(cssName.decorPath, cssPath)}
    >
      {decorPath.map((p, i) =>
        <div
          key={i}
          className={cssName.decorPoint}
          style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
        />
      )}
      {/* 🤔 image instead? */}
      <svg
        width={aabb.width}
        height={aabb.height}
        style={{ transform: `translate(${aabb.x}px, ${aabb.y}px)` }}
      >
        <g style={{ transform: `translate(${-aabb.x}px, ${-aabb.y}px)` }}>
          <polyline
            fill="none" stroke="#5555ff" strokeDasharray="2 2" strokeWidth={1}
            points={decorPath.map(p => `${p.x},${p.y}`).join(' ')}
          />
        </g>
      </svg>
    </div>
  );
}
  
  /**
   * @typedef PathProps
   * @property {NPC.DecorPath} decor
   */
  
   const cssPath = css`
    .${cssName.decorPoint} {
      position: absolute;
      left: -2px;
      top: -2px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      border: 1px solid #ff000088;
    }
   `;
  