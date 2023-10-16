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
    drawRectImage(imgEl, srcOffset, ctxt, rect, darken = true) {
      // ℹ️ target canvas is 1/2 size of source image
      ctxt.drawImage(
        imgEl,
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
          state.drawRectImage(unlitImg, gm.pngRect, ctxt, item.rect);
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
        return; // 👈 Don't hide lights if current room has light (fixes diagonal doors)
      }
      // Hide light by drawing partial image
      const ctxt = state.ctxts[gmId];
      const unlitImg = state.unlitImgs[gmId];
      state.drawRectImage(unlitImg, gm.pngRect, ctxt, meta.rect);
      
      meta.postConnectors.forEach(({ type, id }) => {// Hide light through doors
        // 🚧 for window should draw polygon i.e. rect without window
        const {rect} = assertDefined(type === 'door' ? gm.doorToLightRect[id] : gm.windowToLightRect[id]);
        state.drawRectImage(unlitImg, gm.pngRect, ctxt, rect);
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
      const litImg = state.litImgs[gmId];
      state.drawRectImage(litImg, gm.pngRect, ctxt, meta.rect, false);
      meta.postConnectors.forEach(({ type, id }) => {// Show light through doors
        const {rect} = assertDefined(type === 'door' ? gm.doorToLightRect[id] : gm.windowToLightRect[id]);
        state.drawRectImage(litImg, gm.pngRect, ctxt, rect, false);
        const connectorRect = (type === 'door' ? gm.doors[id] : gm.windows[id]).rect.clone().precision(0);
        state.drawRectImage(litImg, gm.pngRect, ctxt, connectorRect, false);
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
        state.drawRectImage(litImg, gm.pngRect, state.ctxts[gmId], gm.pngRect, false)
        state.initGmLightRects(gmId);
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
    setRoomLit(gmId, roomId, lit) {
      const gm = gms[gmId];
      if (
        state.gmRoomLit[gmId][roomId] === lit
        || !gm.lightSrcs.some(x => x.roomId === roomId)
      ) {
        return;
      }

      // 🚧 rewrite and fix below
      // toggle light in room
      const ctxt = state.ctxts[gmId];
      if (lit) {// clear polygon
        ctxt.globalCompositeOperation = 'destination-out';
        // ctxt.fillStyle = 'white';
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
        const openDoorIds = doorIds.filter(doorId => api.doors.lookup[gmId][doorId].open);
        openDoorIds.forEach(doorId => state.onOpenDoor(gmId, doorId));
        // Show light thru windows by clearing rect
        windowIds.forEach(windowId => {
          const meta = gm.windowToLightRect[windowId];
          meta && state.drawRectImage(state.litImgs[gmId], gm.pngRect, ctxt, meta.rect);
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
  position: absolute;
  --geomorph-filter: ${geomorphFilter};
  filter: var(--geomorph-filter);


  /* img.geomorph {
    position: absolute;
    transform-origin: top left;
    pointer-events: none;
    filter: var(--geomorph-filter);
  } */
  canvas {
    position: absolute;
    pointer-events: none;
    // must dup filter from geomorph
    /* filter: var(--geomorph-filter); */
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
 * @property {(ctxt: CanvasRenderingContext2D, gmId: number) => CanvasPattern} createUnlitPattern
 * @property {(ctxt: CanvasRenderingContext2D, gmId: number, poly: Geom.Poly) => void} drawUnlitPolygon
 * Fill polygon using unlit image, and also darken.
 * @property {(imgEl: HTMLImageElement, srcOffset: Geom.VectJson, ctxt: CanvasRenderingContext2D, rect: Geom.RectJson, darken?: boolean) => void} drawRectImage
 * @property {(gmId: number) => void} initGmLightRects
 * @property {() => void} loadImages
 * @property {(gmId: number, doorId: number) => void} onOpenDoor
 * @property {(gmId: number, doorId: number, lightCurrent?: boolean) => void} onCloseDoor
 * @property {(gmId: number, roomId: number)  => void} recomputeLights
 * //@property {()  => void} setupPixi
 * @property {(gmId: number, roomId: number, lit: boolean)  => void} setRoomLit
 * @property {boolean} ready
 */
