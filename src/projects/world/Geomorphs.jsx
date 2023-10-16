import React from "react";
import { css, cx } from "@emotion/css";
import { geomorphFilter, preDarkenCssRgba } from "./const";
import { Poly } from "../geom";
import { assertDefined, assertNonNull } from "../service/generic";
import { fillPolygons, loadImage } from "../service/dom";
import { geomorphPngPath } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";

/**
 * The images of each geomorph
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { api, api: { gmGraph: { gms } } } = props;

  const state = useStateRef(/** @type {() => State} */ () => ({
    ctxts: [],
    litImgs: [],
    unlitImgs: [],

    gmRoomLit: gms.map(({ rooms }) => rooms.map(_ => true)), // gmGraph is ready
    ready: true,

    createFillPattern(type, ctxt, gmId) {
      const gm = gms[gmId];
      const pattern = assertNonNull(ctxt.createPattern(type === 'unlit' ? state.unlitImgs[gmId] : state.litImgs[gmId], 'no-repeat'));
      pattern.setTransform({ a: 0.5, b: 0, c: 0, d: 0.5, e: gm.pngRect.x, f: gm.pngRect.y });
      return pattern;
    },
    drawPolygon(type, gmId, poly) {
      const ctxt = state.ctxts[gmId];
      ctxt.fillStyle = state.createFillPattern(type, ctxt, gmId);
      fillPolygons(ctxt, [poly]);
      if (type === 'unlit') {
        ctxt.fillStyle = preDarkenCssRgba;
        fillPolygons(ctxt, [poly]);
      }
    },
    drawRectImage(type, gmId, rect, darken = true) {
      // ℹ️ target canvas is 1/2 size of source image
      const ctxt = state.ctxts[gmId];
      const srcOffset = gms[gmId].pngRect;
      ctxt.drawImage(
        type === 'lit' ? state.litImgs[gmId] : state.unlitImgs[gmId],
        (rect.x - srcOffset.x) * 2, (rect.y - srcOffset.y) * 2, rect.width * 2, rect.height * 2,
        rect.x, rect.y, rect.width, rect.height,
      );
      if (darken) {
        /** We also shade by @see {preDarkenCssRgba} as per bake-lighting */
        ctxt.fillStyle = preDarkenCssRgba;
        ctxt.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    },
    initGmLightRects(gmId) {
      const gm = gms[gmId];
      const ctxt = state.ctxts[gmId];
      const unlitImg = state.unlitImgs[gmId];
      gm.doorToLightRect.forEach((item, doorId) => {
        if (item) {
          // ctxt.strokeStyle = '#ff0000'; // ⛔️ Debug
          // ctxt.lineWidth = 1;
          // ctxt.strokeRect(item.rect.x, item.rect.y, item.rect.width, item.rect.height);
          state.drawRectImage('unlit', gmId, item.rect);
        }
      });
    },
    loadImages() {
      gms.forEach(async (gm, gmId) => {
        const [unlitImg, litImg] = await Promise.all([
          loadImage(geomorphPngPath(gm.key)),
          loadImage(geomorphPngPath(gm.key, 'lit')),
        ]);
        state.unlitImgs[gmId] = unlitImg;
        state.litImgs[gmId] = litImg;
        state.drawRectImage('lit', gmId, gm.pngRect, false)
        state.initGmLightRects(gmId);
      });
    },
    onCloseDoor(gmId, doorId, lightIsOn = true) {
      const gm = gms[gmId];
      const meta = gm.doorToLightRect[doorId];
      if (!meta) {
        return;
      }
      if (lightIsOn && (meta.srcRoomId === api.fov.roomId)) {
        return; // 👈 Don't hide lights if current room has light (fixes diagonal doors)
      }
      // Hide light by drawing partial image
      const ctxt = state.ctxts[gmId];
      const unlitImg = state.unlitImgs[gmId];
      state.drawRectImage('unlit', gmId, meta.rect);
      
      meta.postConnectors.forEach(({ type, id }) => {// Hide light through doors
        // 🚧 for window should draw polygon i.e. rect without window
        const {rect} = assertDefined(type === 'door' ? gm.doorToLightRect[id] : gm.windowToLightRect[id]);
        state.drawRectImage('unlit', gmId, rect);
      });
    },
    onOpenDoor(gmId, doorId) {
      const gm = gms[gmId];
      const gmDoors = api.doors.lookup[gmId];
      const meta = gm.doorToLightRect[doorId];
      const ctxt = state.ctxts[gmId];
      if (!meta
        // all prior connectors must be windows or open doors
        || !meta.preConnectors.every(({ type, id }) => type === 'window' || gmDoors[id].open)
        || !state.gmRoomLit[gmId][meta.srcRoomId] // must be on 
      ) {
        return;
      }
      // Show light by drawing rect
      state.drawRectImage('lit', gmId, meta.rect, false);
      meta.postConnectors.forEach(({ type, id }) => {// Show light through doors
        const {rect} = assertDefined(type === 'door' ? gm.doorToLightRect[id] : gm.windowToLightRect[id]);
        state.drawRectImage('lit', gmId, rect, false);
        const connectorRect = (type === 'door' ? gm.doors[id] : gm.windows[id]).rect.clone().precision(0);
        state.drawRectImage('lit', gmId, connectorRect, false);
      });
    },
    recomputeLights(gmId, roomId) {
      if (!state.unlitImgs[gmId]) {
        return; // avoid initialization error
      }
      const gmDoors = api.doors.lookup[gmId];
      gms[gmId].roomGraph.getAdjacentDoors(roomId).forEach(({ doorId }) => {
        if (
          gmDoors[doorId].open
          // if door diagonal, closed, and light in current room, pretend it is open,
          // to avoid "dark square" overlapping current room
          || gmDoors[doorId].angled && gms[gmId].lightSrcs.some(x => x.roomId === roomId)  
        ) {
          state.onOpenDoor(gmId, doorId);
        } else {
          state.onCloseDoor(gmId, doorId);
        }
      });
    },
    setRoomLit(gmId, roomId, nextLit) {
      const gm = gms[gmId];

      if (
        state.gmRoomLit[gmId][roomId] === nextLit
        || !gm.lightSrcs.some(x => x.roomId === roomId)
      ) {
        return;
      }

      state.gmRoomLit[gmId][roomId] = nextLit; // Needed by `onOpenDoor`
      
      const doors = gm.roomGraph.getAdjacentDoors(roomId).map(x => api.doors.lookup[gmId][x.doorId]);
      const windowLightRects = gm.roomGraph.getAdjacentWindows(roomId).flatMap(
        x => gm.windowToLightRect[x.windowId] ?? [],
      );

      if (nextLit) {
        state.drawPolygon('lit', gmId, gm.roomsWithDoors[roomId]);
        doors.forEach(({ open, doorId }) =>
          /**
           * If door open AND light comes from roomId, open it to emit light thru doorway.
           * Otherwise must close door to rub out light from other rooms.
           */
          open && (roomId === gm.doorToLightRect[doorId]?.srcRoomId) ? state.onOpenDoor(gmId, doorId) : state.onCloseDoor(gmId, doorId)
        );
        windowLightRects.forEach(({ rect }) => state.drawRectImage('lit', gmId, rect, false));
      } else {
        state.drawPolygon('unlit', gmId, gm.roomsWithDoors[roomId]);
        doors.forEach(({ doorId, open }) =>
          /**
           * If door open AND light not from roomId, open it to emit light thru doorway.
           * Otherwise must close door to rub out light from roomId.
           */
          open && (roomId !== gm.doorToLightRect[doorId]?.srcRoomId) ? state.onOpenDoor(gmId, doorId) : state.onCloseDoor(gmId, doorId, false)
        );
        windowLightRects.forEach(({ rect, windowId }) => {
          const [poly] = Poly.cutOut([gm.windows[windowId].poly], [Poly.fromRect(rect)]);
          state.drawPolygon('unlit', gmId, poly);
        });
      }
    },
  }), {
    deps: [api],
  });
  
  React.useEffect(() => {
    state.loadImages();
    props.onLoad(state);
  }, []);

  return (
    <div className={cx("geomorphs", rootCss)}>
      {gms.map((gm, gmId) =>
        <canvas
          key={gmId}
          ref={(el) => el && (
            state.ctxts[gmId] = /** @type {CanvasRenderingContext2D} */ (el.getContext('2d'))
          )}
          className={`gm-${gmId}`}
          width={gm.pngRect.width}
          height={gm.pngRect.height}
          style={{ transform: gm.transformStyle }}
          // 🚧 consider scaling up canvas for better graphics
          // width={gm.pngRect.width * 2}
          // height={gm.pngRect.height * 2}
          // style={{
            // left: gm.pngRect.x,
            // top: gm.pngRect.y,
            // transform: `scale(0.5) translate(-${gm.pngRect.width}px, -${gm.pngRect.height}px)`,
          // }}
        />
      )}
    </div>
  );
}

const rootCss = css`
  canvas {
    position: absolute;
    pointer-events: none;
    filter: ${geomorphFilter};
  }
`;

/**
 * @typedef Props @type {object}
 * @property {import('./World').State} api
 * @property {(doorsApi: State) => void} onLoad
*/

/**
 * @typedef State @type {object}
 * @property {CanvasRenderingContext2D[]} ctxts
 * @property {boolean[][]} gmRoomLit
 * Lights on <=> `gmRoomLit[gmId][roomId]` truthy.
 * @property {HTMLImageElement[]} litImgs
 * @property {HTMLImageElement[]} unlitImgs
 * @property {(type: 'lit' | 'unlit', ctxt: CanvasRenderingContext2D, gmId: number) => CanvasPattern} createFillPattern
 * @property {(type: 'lit' | 'unlit', gmId: number, poly: Geom.Poly) => void} drawPolygon
 * Fill polygon using unlit image, and also darken.
 * @property {(type: 'lit' | 'unlit', gmId: number, rect: Geom.RectJson, darken?: boolean) => void} drawRectImage
 * @property {(gmId: number) => void} initGmLightRects
 * @property {() => void} loadImages
 * @property {(gmId: number, doorId: number) => void} onOpenDoor
 * @property {(gmId: number, doorId: number, lightCurrent?: boolean) => void} onCloseDoor
 * @property {(gmId: number, roomId: number)  => void} recomputeLights
 * //@property {()  => void} setupPixi
 * @property {(gmId: number, roomId: number, lit: boolean)  => void} setRoomLit
 * @property {boolean} ready
 */
