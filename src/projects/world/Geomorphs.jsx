import React from "react";
import { css, cx } from "@emotion/css";
import { assertNonNull } from "../service/generic";
import { geomorphPngPath } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";
/**
 * The images of each geomorph
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { api } = props;

  const state = useStateRef(/** @type {() => State} */ () => ({
    canvas: [],
    ready: true,

    initDrawLightRects() {
      api.gmGraph.gms.forEach((gm, gmId) => {
        const canvas = state.canvas[gmId];
        const ctxt = assertNonNull(canvas.getContext('2d'));
        // 🚧 fix transformed geomorphs
        ctxt.setTransform(1, 0, 0, 1, -gm.pngRect.x, -gm.pngRect.y);

        // 🚧 better reference to image
        const imgEl = /** @type {HTMLImageElement} */ (api.panZoom.translateRoot.querySelector(`.fov img[data-gm-key="${gm.key}"]`));
        // target canvas is 1/2 size of source image
        gm.doorToLightRect.forEach((item, doorId) => {
          if (item) {
            const { x, y, width, height } = item.rect;
            ctxt.strokeStyle = '#ff0000';
            ctxt.lineWidth = 1;
            ctxt.strokeRect(x, y, width, height);
            ctxt.drawImage(imgEl, (x - gm.pngRect.x) * 2, (y - gm.pngRect.y) * 2, width * 2, height * 2, x, y, width, height);
            ctxt.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctxt.fillRect(x, y, width, height);
          }
        });

      });
    },
    
  }), {
    deps: [api],
  });
  
  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <div className={cx("geomorphs", rootCss)}>
      {api.gmGraph.gms.map((gm, gmId) =>
        <div
          key={gmId}
          style={{
            transform: gm.transformStyle,
          }}
        >
          <img
            className="geomorph"
            // src={geomorphPngPath(gm.key)}
            src={geomorphPngPath(gm.key, 'lit')}
            draggable={false}
            width={gm.pngRect.width}
            height={gm.pngRect.height}
            style={{ left: gm.pngRect.x, top: gm.pngRect.y }}
          />
          <canvas
            ref={(el) => el && (state.canvas[gmId] = el)}
            width={gm.pngRect.width}
            height={gm.pngRect.height}
            style={{ left: gm.pngRect.x, top: gm.pngRect.y }}
          />
        </div>
      )}
    </div>
  );
}

const rootCss = css`
  position: absolute;

  img.geomorph {
    position: absolute;
    transform-origin: top left;
    pointer-events: none;
    /* filter: brightness(80%) sepia(0.1); */
    filter: brightness(70%) sepia(0.4);
  }
  canvas {
    position: absolute;
    pointer-events: none;
    // must dup filter from geomorph
    filter: brightness(70%) sepia(0.4);
  }
`;

/**
 * @typedef Props @type {object}
 * @property {import('./World').State} api
 * @property {(doorsApi: State) => void} onLoad
*/

/**
 * @typedef State @type {object}
 * @property {HTMLCanvasElement[]} canvas
 * @property {() => void} initDrawLightRects
 * @property {boolean} ready
 */
