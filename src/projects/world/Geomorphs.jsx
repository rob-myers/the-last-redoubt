import React from "react";
import { css, cx } from "@emotion/css";
import { assertDefined, assertNonNull } from "../service/generic";
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

    drawRectImage(imgEl, srcOffset, ctxt, rect) {
      // ℹ️ target canvas is 1/2 size of source image
      ctxt.drawImage(
        imgEl,
        (rect.x - srcOffset.x) * 2, (rect.y - srcOffset.y) * 2, rect.width * 2, rect.height * 2,
        rect.x, rect.y, rect.width, rect.height,
      );
      // ℹ️ we also shade by rgba(0, 0, 0, 0, 0.5) as per bake-lighting
      ctxt.fillRect(rect.x, rect.y, rect.width, rect.height);
    },

    // 🚧 restrict light operations to visible rooms?

    initGmLightRects(gmId) {
      const gm = api.gmGraph.gms[gmId];
      const canvas = state.canvas[gmId];
      const ctxt = assertNonNull(canvas.getContext('2d'));
      ctxt.setTransform(1, 0, 0, 1, -gm.pngRect.x, -gm.pngRect.y);
      ctxt.fillStyle = 'rgba(0, 0, 0, 0.5)';

      const imgEl = api.fov.getImgEl(gmId);
      gm.doorToLightRect.forEach((item, doorId) => {
        if (item) {
          // ctxt.strokeStyle = '#ff0000'; // ⛔️ Debug
          // ctxt.lineWidth = 1;
          // ctxt.strokeRect(item.rect.x, item.rect.y, item.rect.width, item.rect.height);
          state.drawRectImage(imgEl, gm.pngRect, ctxt, item.rect);
        }
      });
    },
    onCloseDoor(gmId, doorId) {
      const gm = api.gmGraph.gms[gmId];
      const meta = gm.doorToLightRect[doorId];
      if (meta) {// Hide light by drawing partial image
        const ctxt = assertNonNull(state.canvas[gmId].getContext('2d'));
        const imgEl = api.fov.getImgEl(gmId);
        state.drawRectImage(imgEl, gm.pngRect, ctxt, meta.rect);
        const open = api.doors.open[gmId];
        meta.postDoorIds.every(postDoorId => {// Hide light up to 1st closed door
          if (open[postDoorId]) {
            const {rect} = assertDefined(gm.doorToLightRect[postDoorId]);
            state.drawRectImage(imgEl, gm.pngRect, ctxt, rect);
            return true; // i.e. continue
          }
        });
      }
    },
    onOpenDoor(gmId, doorId) {
      const gm = api.gmGraph.gms[gmId];
      const open = api.doors.open[gmId];
      const meta = gm.doorToLightRect[doorId];
      if (meta?.preDoorIds.every(preId => open[preId])) {// Show light by clearing rect
        const ctxt = assertNonNull(state.canvas[gmId].getContext('2d'));
        ctxt.clearRect(meta.rect.x, meta.rect.y, meta.rect.width, meta.rect.height);
        meta.postDoorIds.every(postDoorId => {// Show light up to 1st closed door
          if (open[postDoorId]) {
            const {rect} = assertDefined(gm.doorToLightRect[postDoorId]);
            ctxt.clearRect(rect.x, rect.y, rect.width, rect.height);
            return true;
          }
        });
      }
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
 * @property {(imgEl: HTMLImageElement, srcOffset: Geom.VectJson, ctxt: CanvasRenderingContext2D, rect: Geom.RectJson) => void} drawRectImage
 * @property {(gmId: number) => void} initGmLightRects
 * @property {(gmId: number, doorId: number) => void} onOpenDoor
 * @property {(gmId: number, doorId: number) => void} onCloseDoor
 * @property {boolean} ready
 */
