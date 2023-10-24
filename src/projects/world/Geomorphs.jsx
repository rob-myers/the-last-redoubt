import React from "react";
import { geomorphFilter, gmScale } from "./const";
import { Poly } from "../geom";
import { assertDefined, assertNonNull } from "../service/generic";
import { fillPolygons, loadImage } from "../service/dom";
import { geomorphPngPath } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";
import GmsCanvas from "./GmsCanvas";

/**
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { api, api: { gmGraph: { gms } } } = props;

  const state = useStateRef(/** @type {() => State} */ () => ({
    ready: true,
    ctxts: [],
    imgs: { lit: [], unlit: [] },
    isRoomLit: gms.map(({ rooms }) => rooms.map(_ => true)),

    createFillPattern(type, ctxt, gmId) {
      const gm = gms[gmId];
      const pattern = assertNonNull(ctxt.createPattern(type === 'unlit' ? state.imgs.unlit[gmId] : state.imgs.lit[gmId], 'no-repeat'));
      pattern.setTransform({ a: 1 / gmScale, b: 0, c: 0, d: 1 / gmScale, e: gm.pngRect.x, f: gm.pngRect.y });
      return pattern;
    },
    drawPolygonImage(type, gmId, poly) {
      const ctxt = state.ctxts[gmId];
      ctxt.fillStyle = state.createFillPattern(type, ctxt, gmId);
      ctxt.setTransform(gmScale, 0, 0, gmScale, -gmScale * gms[gmId].pngRect.x, -gmScale * gms[gmId].pngRect.y);
      fillPolygons(ctxt, [poly]);
      ctxt.resetTransform();
    },
    drawRectImage(type, gmId, rect) {
      state.ctxts[gmId].drawImage(// Src image & target canvas are scaled by 2
        type === 'lit' ? state.imgs.lit[gmId] : state.imgs.unlit[gmId],
        gmScale * (rect.x - gms[gmId].pngRect.x), gmScale * (rect.y - gms[gmId].pngRect.y), gmScale * rect.width, gmScale * rect.height,
        gmScale * (rect.x - gms[gmId].pngRect.x), gmScale * (rect.y - gms[gmId].pngRect.y), gmScale * rect.width, gmScale * rect.height,
      );
    },
    initLightRects(gmId) {
      gms[gmId].doorToLightRect.forEach(x => x && state.drawRectImage('unlit', gmId, x.rect));
    },
    loadImages() {
      gms.forEach(async (gm, gmId) => {
        const [unlitImg, litImg] = await Promise.all([
          loadImage(geomorphPngPath(gm.key)),
          loadImage(geomorphPngPath(gm.key, 'lit')),
        ]);
        state.imgs.unlit[gmId] = unlitImg;
        state.imgs.lit[gmId] = litImg;
        state.drawRectImage('lit', gmId, gm.pngRect);
        state.initLightRects(gmId);
      });
    },
    onCloseDoor(gmId, doorId, lightIsOn = true) {
      const gm = gms[gmId];
      const meta = gm.doorToLightRect[doorId];
      if (!meta) {
        return;
      }
      // 🚧 fix diagonal doors directly i.e. draw light polygons
      // if (lightIsOn && (meta.srcRoomId === api.fov.roomId)) {
      //   /**
      //    * Don't hide lights if current room has light (fixes diagonal doors).
      //    * 👉 Won't work when FOV unbounded though.
      //    */
      //   return;
      // }
      // Hide light by drawing partial image
      state.drawRectImage('unlit', gmId, meta.rect);
      
      meta.postConnectors.forEach(({ type, id }) => {// Hide light through doors
        // 🚧 for window should draw polygon i.e. rect without window
        const {rect} = assertDefined(type === 'door' ? gm.doorToLightRect[id] : gm.windowToLightRect[id]);
        state.drawRectImage('unlit', gmId, rect);
      });
    },
    onOpenDoor(gmId, doorId) {
      const gm = gms[gmId];
      const doors = api.doors.lookup[gmId];
      const meta = gm.doorToLightRect[doorId];
      if (!meta
        // all prior connectors must be windows or open doors
        || !meta.preConnectors.every(({ type, id }) => type === 'window' || doors[id].open)
        || !state.isRoomLit[gmId][meta.srcRoomId] // light must be on 
      ) {
        return;
      }
      // Show light by drawing rect
      state.drawRectImage('lit', gmId, meta.rect);
      meta.postConnectors.forEach(({ type, id }) => {
        // Show light through doors, and possibly windows
        const {rect} = assertDefined(type === 'door' ? gm.doorToLightRect[id] : gm.windowToLightRect[id]);
        state.drawRectImage('lit', gmId, rect);
        // Show light in doorway/window
        const connectorRect = (type === 'door' ? gm.doors[id] : gm.windows[id]).rect.clone().precision(0);
        state.drawRectImage('lit', gmId, connectorRect);
      });
    },
    recomputeLights(gmId, roomId) {
      if (!state.imgs.unlit[gmId]) {
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
        state.isRoomLit[gmId][roomId] === nextLit
        || !gm.lightSrcs.some(x => x.roomId === roomId)
      ) {
        return;
      }

      state.isRoomLit[gmId][roomId] = nextLit; // Needed by `onOpenDoor`
      
      const doors = gm.roomGraph.getAdjacentDoors(roomId).map(x => api.doors.lookup[gmId][x.doorId]);
      const windowLightRects = gm.roomGraph.getAdjacentWindows(roomId).flatMap(
        x => gm.windowToLightRect[x.windowId] ?? [],
      );

      if (nextLit) {
        state.drawPolygonImage('lit', gmId, gm.roomsWithDoors[roomId]);
        doors.forEach(({ open, doorId }) =>
          /**
           * If door open AND light comes from roomId, open it to emit light thru doorway.
           * Otherwise must close door to rub out light from other rooms.
           */
          open && (roomId === gm.doorToLightRect[doorId]?.srcRoomId) ? state.onOpenDoor(gmId, doorId) : state.onCloseDoor(gmId, doorId)
        );
        windowLightRects.forEach(({ rect }) => state.drawRectImage('lit', gmId, rect));
      } else {
        state.drawPolygonImage('unlit', gmId, gm.roomsWithDoors[roomId]);
        doors.forEach(({ doorId, open }) =>
          /**
           * If door open AND light not from roomId, open it to emit light thru doorway.
           * Otherwise must close door to rub out light from roomId.
           */
          open && (roomId !== gm.doorToLightRect[doorId]?.srcRoomId) ? state.onOpenDoor(gmId, doorId) : state.onCloseDoor(gmId, doorId, false)
        );
        windowLightRects.forEach(({ rect, windowId }) => {
          const [poly] = Poly.cutOut([gm.windows[windowId].poly], [Poly.fromRect(rect)]);
          state.drawPolygonImage('unlit', gmId, poly);
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
    <div className="geomorphs">
      <GmsCanvas
        canvasRef={(el, gmId) => state.ctxts[gmId] = assertNonNull(el.getContext('2d'))}
        gms={gms}
        scaleFactor={gmScale}
        style={{ filter: geomorphFilter }}
      />
    </div>
  );
}

/**
 * @typedef Props @type {object}
 * @property {import('./World').State} api
 * @property {(doorsApi: State) => void} onLoad
*/

/**
 * @typedef State @type {object}
 * @property {CanvasRenderingContext2D[]} ctxts
 * @property {boolean[][]} isRoomLit
 * Lights on iff `isRoomLit[gmId][roomId]`.
 * @property {{ lit: HTMLImageElement[]; unlit: HTMLImageElement[]; }} imgs
 * @property {(type: 'lit' | 'unlit', ctxt: CanvasRenderingContext2D, gmId: number) => CanvasPattern} createFillPattern
 * @property {(type: 'lit' | 'unlit', gmId: number, poly: Geom.Poly) => void} drawPolygonImage
 * Fill polygon using unlit image, and also darken.
 * @property {(type: 'lit' | 'unlit', gmId: number, rect: Geom.RectJson) => void} drawRectImage
 * @property {(gmId: number) => void} initLightRects
 * Currently assumes all doors initially closed
 * @property {() => void} loadImages
 * @property {(gmId: number, doorId: number) => void} onOpenDoor
 * @property {(gmId: number, doorId: number, lightCurrent?: boolean) => void} onCloseDoor
 * @property {(gmId: number, roomId: number)  => void} recomputeLights
 * @property {(gmId: number, roomId: number, lit: boolean)  => void} setRoomLit
 * @property {boolean} ready
 */
