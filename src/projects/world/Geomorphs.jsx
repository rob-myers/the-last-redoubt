import React from "react";
import { css, cx } from "@emotion/css";
import { cssName } from "../service/const";
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
    doorwaysImg: [], 
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

    /**
     * draw from unlit.doorways
     * - precision(0) avoids drawRect artifacts
     * - door orthonormal by assumption, i.e. light only
     *   reaches diagonal door if source adjacent.
     */
    drawUnlitDoorway(ctxt, gmId, doorId) {
      const gm = api.gmGraph.gms[gmId];
      const doorwaysImg = state.doorwaysImg[gmId];
      const doorRect = gm.doors[doorId].rect.clone().precision(0);
      state.drawRectImage(doorwaysImg, gm.pngRect, ctxt, doorRect);
    },

    initGmLightRects(gmId) {
      const gm = api.gmGraph.gms[gmId];
      const canvas = state.canvas[gmId];
      const ctxt = assertNonNull(canvas.getContext('2d'));
      ctxt.setTransform(1, 0, 0, 1, -gm.pngRect.x, -gm.pngRect.y);
      // ctxt.setTransform(2, 0, 0, 2, -2 * gm.pngRect.x, -2 * gm.pngRect.y);
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
      if (!meta || gm.lightSrcs[meta.lightId].roomId === api.fov.roomId) {
        // Don't hide lights if current room has light source,
        return; // which fixes non-orthonormal doors
      }
      // Hide light by drawing partial image
      const ctxt = assertNonNull(state.canvas[gmId].getContext('2d'));
      const imgEl = api.fov.getImgEl(gmId);
      state.drawRectImage(imgEl, gm.pngRect, ctxt, meta.rect);
      
      meta.postDoorIds.forEach(postDoorId => {// Hide light through doors
        const {rect} = assertDefined(gm.doorToLightRect[postDoorId]);
        state.drawRectImage(imgEl, gm.pngRect, ctxt, rect);
        state.drawUnlitDoorway(ctxt, gmId, postDoorId);
      });
    },
    onOpenDoor(gmId, doorId) {
      const gm = api.gmGraph.gms[gmId];
      const open = api.doors.open[gmId];
      const meta = gm.doorToLightRect[doorId];
      const ctxt = assertNonNull(state.canvas[gmId].getContext('2d'));
      if (!meta || meta.preDoorIds.some(preId => !open[preId])) {
        // Could do this once at beginning, but require unlit.doorways loaded
        state.drawUnlitDoorway(ctxt, gmId, doorId);
        return; // Don't show light unless all requisite doors are open
      }
      // Show light by clearing rect
      ctxt.clearRect(meta.rect.x, meta.rect.y, meta.rect.width, meta.rect.height);
      meta.postDoorIds.forEach(postDoorId => {// Show light through doors
        const {rect} = assertDefined(gm.doorToLightRect[postDoorId]);
        ctxt.clearRect(rect.x, rect.y, rect.width, rect.height);
        const doorRect = gm.doors[postDoorId].rect.clone().precision(0);
        ctxt.clearRect(doorRect.x, doorRect.y, doorRect.width, doorRect.height);
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
            src={geomorphPngPath(gm.key, 'lit')}
            draggable={false}
            width={gm.pngRect.width}
            height={gm.pngRect.height}
            style={{ left: gm.pngRect.x, top: gm.pngRect.y }}
          />
          <img
            className="unlit-doorways"
            src={geomorphPngPath(gm.key, 'unlit.doorways')}
            onLoad={x => state.doorwaysImg[gmId] = /** @type {HTMLImageElement} */(x.target)}
          />
          <canvas
            ref={(el) => el && (state.canvas[gmId] = el)}
            width={gm.pngRect.width}
            height={gm.pngRect.height}
            // width={gm.pngRect.width * 2}
            // height={gm.pngRect.height * 2}
            style={{
              left: gm.pngRect.x,
              top: gm.pngRect.y,
              // transform: `scale(0.5) translate(-${gm.pngRect.width}px, -${gm.pngRect.height}px)`,
            }}
          />
        </div>
      )}
    </div>
  );
}

const rootCss = css`
  position: absolute;
  /**
   * - brightness(70%) sepia(0.4);
   * - brightness(80%) sepia(0.1);
   */
  ${cssName.geomorphFilter}: brightness(70%) sepia(0.1) contrast(1);

  img.geomorph {
    position: absolute;
    transform-origin: top left;
    pointer-events: none;
    filter: var(${cssName.geomorphFilter});
  }
  img.unlit-doorways {
    /** Used only as canvas drawImage source */
    display: none;
  }
  canvas {
    position: absolute;
    pointer-events: none;
    // must dup filter from geomorph
    filter: var(${cssName.geomorphFilter});
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
 * @property {HTMLImageElement[]} doorwaysImg
 * @property {(imgEl: HTMLImageElement, srcOffset: Geom.VectJson, ctxt: CanvasRenderingContext2D, rect: Geom.RectJson) => void} drawRectImage
 * @property {(ctxt: CanvasRenderingContext2D, gmId: number, doorId: number) => void} drawUnlitDoorway
 * @property {(gmId: number) => void} initGmLightRects
 * @property {(gmId: number, doorId: number) => void} onOpenDoor
 * @property {(gmId: number, doorId: number) => void} onCloseDoor
 * @property {boolean} ready
 */
