import React from "react";
import { css, cx } from "@emotion/css";
import { cssName, preDarkenCssRgba } from "./const";
import { Poly } from "../geom";
import { assertDefined, assertNonNull } from "../service/generic";
import { fillPolygons } from "../service/dom";
import { geomorphPngPath } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";
/**
 * The images of each geomorph
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { api, api: { gmGraph: { gms } } } = props;

  const state = useStateRef(/** @type {() => State} */ () => ({
    canvas: [],
    gmRoomLit: gms.map(({ rooms }) => rooms.map(_ => true)), // gmGraph is ready
    unlitImgs: [],
    ready: true,

    createUnlitPattern(ctxt, gmId) {
      const gm = gms[gmId];
      const pattern = assertNonNull(ctxt.createPattern(state.unlitImgs[gmId], 'no-repeat'));
      pattern.setTransform({ a: 0.5, b: 0, c: 0, d: 0.5, e: gm.pngRect.x, f: gm.pngRect.y });
      return pattern;
    },
    drawUnlitPolygon(ctxt, gmId, poly) {
      ctxt.fillStyle = state.createUnlitPattern(ctxt, gmId);
      fillPolygons(ctxt, [poly]);
      ctxt.fillStyle = preDarkenCssRgba;
      fillPolygons(ctxt, [poly]);
    },
    drawRectImage(imgEl, srcOffset, ctxt, rect) {
      // ℹ️ target canvas is 1/2 size of source image
      ctxt.drawImage(
        imgEl,
        (rect.x - srcOffset.x) * 2, (rect.y - srcOffset.y) * 2, rect.width * 2, rect.height * 2,
        rect.x, rect.y, rect.width, rect.height,
      );
      /**
       * We also shade by
       * @see {preDarkenCssRgba} as per bake-lighting
       */
      ctxt.fillStyle = preDarkenCssRgba;
      ctxt.fillRect(rect.x, rect.y, rect.width, rect.height);
    },
    initGmLightRects(gmId) {
      const gm = gms[gmId];
      const canvas = state.canvas[gmId];
      const ctxt = assertNonNull(canvas.getContext('2d'));
      ctxt.setTransform(1, 0, 0, 1, 0, 0);
      // ctxt.setTransform(2, 0, 0, 2, 0, 0);
      ctxt.fillStyle = preDarkenCssRgba;

      const imgEl = state.unlitImgs[gmId];
      gm.doorToLightRect.forEach((item, doorId) => {
        if (item) {
          // ctxt.strokeStyle = '#ff0000'; // ⛔️ Debug
          // ctxt.lineWidth = 1;
          // ctxt.strokeRect(item.rect.x, item.rect.y, item.rect.width, item.rect.height);
          state.drawRectImage(imgEl, gm.pngRect, ctxt, item.rect);
        }
      });
    },
    onCloseDoor(gmId, doorId, lightIsOn = true) {
      const gm = gms[gmId];
      const meta = gm.doorToLightRect[doorId];
      if (!meta) {
        return;
      }
      if (lightIsOn && (meta.srcRoomId === api.fov.roomId)) {
        /**
         * Don't hide lights if current room has light source,
         * which fixes diagonal doors e.g. see 301 bridge.
         */
        return;
      }
      // Hide light by drawing partial image
      const ctxt = assertNonNull(state.canvas[gmId].getContext('2d'));
      const imgEl = state.unlitImgs[gmId];
      state.drawRectImage(imgEl, gm.pngRect, ctxt, meta.rect);
      
      meta.postConnectors.forEach(({ type, id }) => {// Hide light through doors
        // 🚧 for window should draw polygon i.e. rect without window
        const {rect} = assertDefined(type === 'door' ? gm.doorToLightRect[id] : gm.windowToLightRect[id]);
        state.drawRectImage(imgEl, gm.pngRect, ctxt, rect);
      });
    },
    onOpenDoor(gmId, doorId) {
      const gm = gms[gmId];
      const open = api.doors.open[gmId];
      const meta = gm.doorToLightRect[doorId];
      const ctxt = assertNonNull(state.canvas[gmId].getContext('2d'));
      if (!meta
        // all prior connectors must be windows or open doors
        || !meta.preConnectors.every(({ type, id }) => type === 'window' || open[id])
        || !state.gmRoomLit[gmId][meta.srcRoomId] // must be on 
      ) {
        return;
      }
      // Show light by clearing rect
      ctxt.clearRect(meta.rect.x, meta.rect.y, meta.rect.width, meta.rect.height);
      meta.postConnectors.forEach(({ type, id }) => {// Show light through doors
        const {rect} = assertDefined(type === 'door' ? gm.doorToLightRect[id] : gm.windowToLightRect[id]);
        ctxt.clearRect(rect.x, rect.y, rect.width, rect.height);
        const connectorRect = (type === 'door' ? gm.doors[id] : gm.windows[id]).rect.clone().precision(0);
        ctxt.clearRect(connectorRect.x, connectorRect.y, connectorRect.width, connectorRect.height);
      });
    },
    onLoadUnlitImage(e) {
      const imgEl = /** @type {HTMLImageElement} */ (e.target);
      const gmId = Number(imgEl.dataset.gmId);
      state.unlitImgs[gmId] = imgEl;
      state.initGmLightRects(gmId);
    },
    setRoomLit(gmId, roomId, lit) {
      const gm = gms[gmId];
      if (
        state.gmRoomLit[gmId][roomId] === lit
        || !gm.lightSrcs.some(x => x.roomId === roomId)
      ) {
        return;
      }

      // toggle light in room
      const ctxt = assertNonNull(state.canvas[gmId].getContext('2d'));
      ctxt.setTransform(1, 0, 0, 1, 0, 0);
      if (lit) {// clear polygon
        ctxt.globalCompositeOperation = 'destination-out';
        ctxt.fillStyle = 'white';
        fillPolygons(ctxt, [gm.roomsWithDoors[roomId]]);
        ctxt.globalCompositeOperation = 'source-over';
      } else {
        state.drawUnlitPolygon(ctxt, gmId, gm.roomsWithDoors[roomId]);
      }

      state.gmRoomLit[gmId][roomId] = lit;

      // toggle light rects
      const doorIds = gm.roomGraph.getAdjacentDoors(roomId).map(x => x.doorId);
      const windowIds = gm.roomGraph.getAdjacentWindows(roomId).map(x => x.windowId);
      if (lit) {
        const openDoorIds = doorIds.filter(doorId => api.doors.open[gmId][doorId]);
        openDoorIds.forEach(doorId => state.onOpenDoor(gmId, doorId));
        // Show light thru windows by clearing rect
        windowIds.forEach(windowId => {
          const meta = gm.windowToLightRect[windowId];
          meta && ctxt.clearRect(meta.rect.x, meta.rect.y, meta.rect.width, meta.rect.height);
        });
      } else {
        doorIds.forEach(doorId => state.onCloseDoor(gmId, doorId, false));
        // Hide light thru windows by drawing partial polygonal image:
        // windows can cover part of room polygon, so we exclude them
        windowIds.forEach(windowId => {
          const meta = gm.windowToLightRect[windowId];
          if (meta) {// 🚧 could precompute this polygon
            const [poly] = Poly.cutOut([gm.windows[windowId].poly], [Poly.fromRect(meta.rect)]);
            state.drawUnlitPolygon(ctxt, gmId, poly);
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
      {gms.map((gm, gmId) =>
        <div
          key={gmId}
          style={{ transform: gm.transformStyle }}
          className={`gm-${gmId}`}
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
            className="geomorph-unlit"
            style={{ display: 'none' }}
            src={geomorphPngPath(gm.key)}
            onLoad={state.onLoadUnlitImage}
            data-gm-key={gm.key}
            data-gm-id={gmId}
          />
          <canvas
            ref={(el) => el && (state.canvas[gmId] = el)}
            width={gm.pngRect.width}
            height={gm.pngRect.height}
            // width={gm.pngRect.width * 2}
            // height={gm.pngRect.height * 2}
            style={{
              // left: gm.pngRect.x,
              // top: gm.pngRect.y,
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

  ${cssName.geomorphFilter}: brightness(50%) sepia(0.1) contrast(1.3);

  img.geomorph {
    position: absolute;
    transform-origin: top left;
    pointer-events: none;
    filter: var(${cssName.geomorphFilter});
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
 * @property {boolean[][]} gmRoomLit
 * Lights on <=> `gmRoomLit[gmId][roomId]` truthy.
 * @property {HTMLImageElement[]} unlitImgs
 * @property {(ctxt: CanvasRenderingContext2D, gmId: number) => CanvasPattern} createUnlitPattern
 * @property {(ctxt: CanvasRenderingContext2D, gmId: number, poly: Geom.Poly) => void} drawUnlitPolygon
 * Fill polygon using unlit image, and also darken.
 * @property {(imgEl: HTMLImageElement, srcOffset: Geom.VectJson, ctxt: CanvasRenderingContext2D, rect: Geom.RectJson) => void} drawRectImage
 * @property {(gmId: number) => void} initGmLightRects
 * @property {(gmId: number, doorId: number) => void} onOpenDoor
 * @property {(gmId: number, doorId: number, lightCurrent?: boolean) => void} onCloseDoor
 * @property {(e: React.SyntheticEvent<HTMLElement>) => void} onLoadUnlitImage
 * @property {(gmId: number, roomId: number, lit: boolean)  => void} setRoomLit
 * @property {boolean} ready
 */
