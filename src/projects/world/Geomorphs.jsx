import React from "react";
import { css, cx } from "@emotion/css";
import { geomorphPngPath } from "../service/geomorph";

/**
 * The images of each geomorph
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { gmGraph } = props.api;
  return (
    <div className={cx("geomorphs", rootCss)}>
      {gmGraph.gms.map((gm, gmId) =>
        <img
          key={gmId}
          className="geomorph"
          // src={geomorphPngPath(gm.key)}
          src={geomorphPngPath(gm.key, 'lit')}
          draggable={false}
          width={gm.pngRect.width}
          height={gm.pngRect.height}
          style={{
            left: gm.pngRect.x,
            top: gm.pngRect.y,
            transform: gm.transformStyle,
            transformOrigin: gm.transformOrigin,
          }}
        />
      )}
    </div>
  );
}

/**
 * @typedef Props @type {object}
 * @property {import('./World').State} api
 */

const rootCss = css`
  isolation: isolate;

  img.geomorph {
    position: absolute;
    transform-origin: top left;
    pointer-events: none;
    /* filter: brightness(80%) sepia(0.1); */
    filter: brightness(70%) sepia(0.4);
  }
  
  img.geomorph-shade {
    position: absolute;
    transform-origin: top left;
    pointer-events: none;
    filter: brightness(120%);
    mix-blend-mode: hard-light;
  }

`;
