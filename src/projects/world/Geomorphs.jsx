import React from "react";
import { geomorphFilter, gmScale } from "./const";
import { Mat, Poly } from "../geom";
import { assertDefined, assertNonNull } from "../service/generic";
import { fillPolygons, loadImage } from "../service/dom";
import { imageService } from "../service/image";
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
    offscreen: { lit: [], unlit: [] },
    isRoomLit: gms.map(({ rooms }) => rooms.map(_ => true)),

    createFillPattern(type, ctxt, gmId) {
      const gm = gms[gmId];
      const pattern = assertNonNull(ctxt.createPattern(state.offscreen[type][gmId].canvas, 'no-repeat'));
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
      state.ctxts[gmId].drawImage(// Src/target canvas are scaled by `gmScale`
        state.offscreen[type][gmId].canvas,
        gmScale * (rect.x - gms[gmId].pngRect.x), gmScale * (rect.y - gms[gmId].pngRect.y), gmScale * rect.width, gmScale * rect.height,
        gmScale * (rect.x - gms[gmId].pngRect.x), gmScale * (rect.y - gms[gmId].pngRect.y), gmScale * rect.width, gmScale * rect.height,
      );
    },
    initDrawIds() {
      const ctxt = imageService.getCtxt([0, 0]);

      gms.forEach((gm, gmId) => {
        ctxt.canvas.width = gm.pngRect.width * gmScale;
        ctxt.canvas.height = gm.pngRect.height * gmScale;

        ctxt.resetTransform();
        ctxt.clearRect(0, 0, ctxt.canvas.width, ctxt.canvas.height);

        ctxt.transform(gmScale, 0, 0, gmScale, -gmScale * gm.pngRect.x, -gmScale * gm.pngRect.y);
        ctxt.transform(...gm.inverseMatrix.toArray());
        const localTransform = ctxt.getTransform();

        // gm/room/door ids
        let fontPx = 7;
        const debugIdOffset = 12;
        
        const rotAbout = new Mat;
        ctxt.textBaseline = 'top';

        gm.doors.forEach(({ poly, roomIds, normal }, doorId) => {
          const center = gm.matrix.transformPoint(poly.center);
          normal = gm.matrix.transformSansTranslate(normal.clone());

          const doorText = `${gmId} ${doorId}`;
          ctxt.font = `${fontPx = 6}px Courier New`;
          const textWidth = ctxt.measureText(doorText).width;
          const idPos = center.clone().translate(-textWidth/2, -fontPx/2);

          if (normal.y === 0)
            ctxt.transform(...rotAbout.setRotationAbout(-Math.PI/2, center).toArray());
          else if (normal.x * normal.y !== 0) // Fixes diagonal doors?
            ctxt.transform(...rotAbout.setRotationAbout(-Math.PI/4 * Math.sign(normal.x * normal.y), center).toArray());

          if (gm.isHullDoor(doorId)) {// Offset so can see both (gmId, roomId)'s
            idPos.addScaledVector(normal.clone().rotate(normal.y === 0 ? 0 : Math.PI/2), 12 * (roomIds[0] === null ? 1 : -1));
          }

          ctxt.fillStyle = '#222';
          ctxt.fillRect(idPos.x, idPos.y, textWidth, fontPx);
          ctxt.fillStyle = '#ffffff';
          ctxt.fillText(doorText, idPos.x, idPos.y);
          
          ctxt.setTransform(localTransform);
          
          roomIds.forEach((roomId, i) => {
            if (roomId === null) return;
            ctxt.font = `${fontPx = 7}px Courier New`;
            const roomText = gm.isHullDoor(doorId) ? `${gmId} ${roomId}` : `${roomId}`;
            const textWidth = ctxt.measureText(roomText).width;
            const idPos = center.clone()
              .addScaledVector(normal, (i === 0 ? 1 : -1) * debugIdOffset)
              .translate(-textWidth/2, -fontPx/2)
            ;
            ctxt.fillStyle = '#ffffffbb';
            ctxt.fillText(roomText, idPos.x, idPos.y);
          });
        });

        // gmScale === gmScale
        state.offscreen.lit[gmId].drawImage(ctxt.canvas, 0, 0);
        state.offscreen.unlit[gmId].drawImage(ctxt.canvas, 0, 0);
      });

      imageService.freeCtxts(ctxt);
    },
    initLightThrus(gmId) {
      gms[gmId].doorToLightThru.forEach(x => x && state.drawRectImage('unlit', gmId, x.rect));
    },
    loadImages() {
      state.ctxts.forEach(ctxt => ctxt.clearRect(0, 0, ctxt.canvas.width, ctxt.canvas.height)); // HMR

      Promise.all(
        gms.map(async (gm, gmId) => {
          const [unlitImg, litImg] = await Promise.all([
            loadImage(geomorphPngPath(gm.key)),
            loadImage(geomorphPngPath(gm.key, 'lit')),
          ]);
          state.offscreen.unlit[gmId] = imageService.getCtxt(unlitImg);
          state.offscreen.lit[gmId] = imageService.getCtxt(litImg);
        })
      ).then(() => {
        state.initDrawIds(); // Draw into state.offscreen
        gms.forEach((gm, gmId) => {
          state.drawRectImage('lit', gmId, gm.pngRect);
          state.initLightThrus(gmId);
        });
      });

      return () => gms.forEach((_, gmId) =>
        imageService.freeCtxts(state.offscreen.unlit[gmId], state.offscreen.lit[gmId])
      );
    },
    onCloseDoor(gmId, doorId, lightIsOn = true) {
      const gm = gms[gmId];
      const meta = gm.doorToLightThru[doorId];
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
        const {rect} = assertDefined(type === 'door' ? gm.doorToLightThru[id] : gm.windowToLightThru[id]);
        state.drawRectImage('unlit', gmId, rect);
      });
    },
    onOpenDoor(gmId, doorId) {
      const gm = gms[gmId];
      const doors = api.doors.lookup[gmId];
      const meta = gm.doorToLightThru[doorId];
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
        const {rect} = assertDefined(type === 'door' ? gm.doorToLightThru[id] : gm.windowToLightThru[id]);
        state.drawRectImage('lit', gmId, rect);
        // Show light in doorway/window
        const connectorRect = (type === 'door' ? gm.doors[id] : gm.windows[id]).rect.clone().precision(0);
        state.drawRectImage('lit', gmId, connectorRect);
      });
    },
    recomputeLights(gmId, roomId) {
      if (!state.offscreen.unlit[gmId]) {
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
        x => gm.windowToLightThru[x.windowId] ?? [],
      );

      if (nextLit) {
        state.drawPolygonImage('lit', gmId, gm.roomsWithDoors[roomId]);
        doors.forEach(({ open, doorId }) =>
          /**
           * If door open AND light comes from roomId, open it to emit light thru doorway.
           * Otherwise must close door to rub out light from other rooms.
           */
          open && (roomId === gm.doorToLightThru[doorId]?.srcRoomId) ? state.onOpenDoor(gmId, doorId) : state.onCloseDoor(gmId, doorId)
        );
        windowLightRects.forEach(({ rect }) => state.drawRectImage('lit', gmId, rect));
      } else {
        state.drawPolygonImage('unlit', gmId, gm.roomsWithDoors[roomId]);
        doors.forEach(({ doorId, open }) =>
          /**
           * If door open AND light not from roomId, open it to emit light thru doorway.
           * Otherwise must close door to rub out light from roomId.
           */
          open && (roomId !== gm.doorToLightThru[doorId]?.srcRoomId) ? state.onOpenDoor(gmId, doorId) : state.onCloseDoor(gmId, doorId, false)
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
    const cleanup = state.loadImages();
    props.onLoad(state);
    return cleanup;
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
 * @property {{ lit: CanvasRenderingContext2D[]; unlit: CanvasRenderingContext2D[]; }} offscreen
 * @property {(type: 'lit' | 'unlit', ctxt: CanvasRenderingContext2D, gmId: number) => CanvasPattern} createFillPattern
 * @property {(type: 'lit' | 'unlit', gmId: number, poly: Geom.Poly) => void} drawPolygonImage
 * Fill polygon using unlit image, and also darken.
 * @property {(type: 'lit' | 'unlit', gmId: number, rect: Geom.RectJson) => void} drawRectImage
 * @property {() => void} initDrawIds
 * @property {(gmId: number) => void} initLightThrus
 * Currently assumes all doors initially closed
 * @property {() => () => void} loadImages Returns cleanup
 * @property {(gmId: number, doorId: number) => void} onOpenDoor
 * @property {(gmId: number, doorId: number, lightCurrent?: boolean) => void} onCloseDoor
 * @property {(gmId: number, roomId: number)  => void} recomputeLights
 * @property {(gmId: number, roomId: number, lit: boolean)  => void} setRoomLit
 * @property {boolean} ready
 */
