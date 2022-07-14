import React from "react";
import { css, cx } from "@emotion/css";
import { geomorphPngPath } from "../service/geomorph";

/**
 * The images of each geomorph
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  return (
    <div className={cx("geomorphs", rootCss)}>
      {props.gms.map((gm, gmId) => (
        <img
          key={gmId}
          className="geomorph"
          src={geomorphPngPath(gm.key)}
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
      ))}
    </div>
  );
}

/**
 * @typedef Props @type {object}
 * @property {Geomorph.GeomorphDataInstance[]} gms
 */

const rootCss = css`
  img.geomorph {
    position: absolute;
    transform-origin: top left;
    pointer-events: none;
    filter: brightness(80%);
  }
`;
