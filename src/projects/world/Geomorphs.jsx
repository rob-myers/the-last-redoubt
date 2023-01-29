import React from "react";
import { css, cx } from "@emotion/css";
import { geomorphPngPath } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";
/**
 * The images of each geomorph
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { gmGraph } = props.api;

  const state = useStateRef(/** @type {() => State} */ () => ({
    canvas: [],
    ready: true,

    // 🚧 adapt
    // /** @param {number} gmId */
    // drawInvisibleInCanvas(gmId) {
    //   const canvas = state.canvas[gmId];
    //   const ctxt = assertNonNull(canvas.getContext('2d'));
    //   const gm = gms[gmId];

    //   ctxt.setTransform(1, 0, 0, 1, 0, 0);
    //   ctxt.clearRect(0, 0, canvas.width, canvas.height);
    //   ctxt.setTransform(1, 0, 0, 1, -gm.pngRect.x, -gm.pngRect.y);
    //   ctxt.fillStyle = '#555';
    //   ctxt.strokeStyle = '#000';

    //   // Handle extension of open visible doors (orig via `relate-connectors` tag)
    //   const relDoorIds = gm.doors.flatMap((_, i) =>
    //     state.vis[gmId][i] && state.open[gmId][i] && gm.relDoorId[i]?.doorIds || []
    //   ).filter(doorId => state.open[gmId][doorId]);
      
    //   gm.doors.forEach(({ poly }, doorId) => {
    //     if (!state.vis[gmId][doorId] && !relDoorIds.includes(doorId)) {
    //       fillPolygon(ctxt, [poly]);
    //       ctxt.stroke();
    //     }
    //   });
    // },

  }));

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <div className={cx("geomorphs", rootCss)}>
      {gmGraph.gms.map((gm, gmId) =>
        <div
          key={gmId}
          style={{
            transform: gm.transformStyle,
            transformOrigin: gm.transformOrigin, // Needed?
          }}
        >
          <img
            className="geomorph"
            // src={geomorphPngPath(gm.key)}
            src={geomorphPngPath(gm.key, 'lit')}
            draggable={false}
            width={gm.pngRect.width}
            height={gm.pngRect.height}
            style={{
              left: gm.pngRect.x,
              top: gm.pngRect.y,
            }}
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
`;

/**
 * @typedef Props @type {object}
 * @property {import('./World').State} api
 * @property {(doorsApi: State) => void} onLoad
*/

/**
 * @typedef State @type {object}
 * @property {HTMLCanvasElement[]} canvas
 * @property {boolean} ready
 */
