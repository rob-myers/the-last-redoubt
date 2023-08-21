import React from "react";
import { css, cx } from "@emotion/css";
import { Rect } from "../geom";
import { cssName } from "./const";

/**
 * @param {PathProps} props 
 */
export default function PathIndicator({ def }) {
  const aabb = Rect.fromPoints(...def.path);

  return (
    <div
      // key={decor.updatedAt}
      data-key={def.key}
      data-meta={JSON.stringify(def.meta)}
      // className={cx(cssName.decorPath, cssPath, `gm-${decor.meta.gmId}`)}
      className={cx(cssName.decorPath, cssPath)}
    >
      {def.path.map((p, i) =>
        <div
          key={i}
          className={cssName.decorPathPoint}
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
            fill="none"
            strokeDasharray="2 2"
            strokeWidth={1}
            points={def.path.map(p => `${p.x},${p.y}`).join(' ')}
          />
        </g>
      </svg>
    </div>
  );
}
  
  /**
   * @typedef PathProps
   * @property {NPC.PathIndicatorDef} def
   */
  
   const cssPath = css`
    position: absolute;
    ${cssName.decorPathColour}: #ffffff44;

    .${cssName.decorPathPoint} {
      position: absolute;
      left: -2px;
      top: -2px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      border: 1px solid #ff000088;
    }

    svg polyline {
      stroke: var(${cssName.decorPathColour});
    }
  `;
  