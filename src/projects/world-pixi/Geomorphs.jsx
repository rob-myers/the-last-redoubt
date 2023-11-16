import React from "react";
import { useQueries } from "react-query";

import { Assets } from "@pixi/assets";
import { RenderTexture } from "@pixi/core";
import { Graphics } from "@pixi/graphics";

import { Poly } from "../geom";
import { assertDefined, assertNonNull } from "../service/generic";
import { gmScale } from "../world/const";
import useStateRef from "../hooks/use-state-ref";
import { colorMatrixFilter, tempMatrix } from "./Misc";
import GmSprites from "./GmSprites";

/**
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { api } = props;
  const { gmGraph: { gms } } = api;
  
  useQueries(gms.map((gm, gmId) => ({
    queryKey: `${gm.key}.${gmId}`, // gmId for dups
    queryFn: async () => {
      state.preloadTex(gmId);
      await Promise.all(/** @type {const} */ (['lit', 'unlit']).map(async type =>
        state[type][gmId] = await Assets.load(
          `/assets/geomorph/${gm.key}${type === 'lit' ? '.lit.webp' : '.webp'}`
        )
      ));
      // Async bootstrapping
      state.initTex(gmId);
      api.doors.initTex(gmId);
      api.decor.initByRoom(gmId);
      state.initHit(gmId);
    },
  })));

  const state = useStateRef(/** @type {() => State} */ () => ({
    ready: true,
    lit: [],
    unlit: [],
    gfx: new Graphics(),
    
    tex: gms.map(gm => RenderTexture.create({ width: gmScale * gm.pngRect.width, height: gmScale * gm.pngRect.height })),
    hit: gms.map(gm => RenderTexture.create({ width: gm.pngRect.width, height: gm.pngRect.height })),

    isRoomLit: gms.map(({ rooms }) => rooms.map(_ => true)),

    drawPolygonImage(type, gmId, poly) {
      const gfx = state.gfx;
      gfx.beginTextureFill({ texture: state[type][gmId] });
      gfx.drawPolygon(poly.outline);
      gfx.endFill();
    },
    drawRectImage(type, gmId, rect) {
      const gfx = state.gfx;
      gfx.beginTextureFill({ texture: state[type][gmId] });
      gfx.drawRect(// Src/target canvas are scaled by `gmScale`
        gmScale * (rect.x - gms[gmId].pngRect.x), gmScale * (rect.y - gms[gmId].pngRect.y), gmScale * rect.width, gmScale * rect.height,
      );
      gfx.endFill();
    },
    initHit(gmId) {
      const gm = gms[gmId];
      const gfx = state.gfx.clear().setTransform(-gm.pngRect.x, -gm.pngRect.y);
      // doors
      gm.doors.forEach(({ poly }, doorId) => {
        // Can assume ≤ 256 doors in a geomorph
        gfx.beginFill(`rgba(255, 0, ${doorId}, 1)`);
        gfx.drawPolygon(poly.outline);
        gfx.endFill();
      });
      // decor
      api.decor.byRoom[gmId].forEach(({ points }, roomId) =>
        // Assume ≤ 256 DecorPoints in a room
        points.forEach((d, pointId) => {
          const center = gm.toLocalCoords(d);
          gfx.beginFill(`rgba(127, ${roomId}, ${pointId}, 1)`);
          gfx.drawCircle(center.x, center.y, 5); // 🚧 hard-coded radius
          gfx.endFill();
        })
      );
      api.renderInto(gfx, state.hit[gmId]);
    },
    preloadTex(gmId) {
      const gm = gms[gmId];
      const gfx = state.gfx.clear();
      gfx.transform.setFromMatrix(tempMatrix.set(gmScale, 0, 0, gmScale, -gm.pngRect.x * gmScale, -gm.pngRect.y * gmScale));
      gfx.lineStyle({ width: 8, color: 0x999999 });
      gfx.beginFill(0x000000);
      gfx.drawPolygon(gm.hullPoly[0].outline)
      gfx.endFill()

      gfx.lineStyle({ width: 4, color: 0x999999 });
      gfx.fill.alpha = 0;
      gfx.beginFill();
      gfx.drawPolygon(gm.navPoly[0].outline)
      gfx.endFill();
      api.renderInto(gfx, state.tex[gmId]);
    },
    initTex(gmId) {
      // draw from image -> image with identity transform
      const gm = gms[gmId];
      const gfx = state.gfx.clear().setTransform();
      // draw lit
      gfx.beginTextureFill({ texture: state.lit[gmId] });
      gfx.drawRect(0, 0, gm.pngRect.width * gmScale, gm.pngRect.height * gmScale);
      gfx.endFill();
      // draw all unlit rects
      gm.doorToLightRect.forEach(x => {
        if (x) {
          gfx.beginTextureFill({ texture: state.unlit[gmId] });
          gfx.drawRect(gmScale * (x.rect.x - gms[gmId].pngRect.x), gmScale * (x.rect.y - gms[gmId].pngRect.y), gmScale * x.rect.width, gmScale * x.rect.height);
          gfx.endFill();
        }
      });
      api.renderInto(gfx, state.tex[gmId]);
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
      state.gfx.clear().setTransform();
      // Hide light by drawing partial image
      state.drawRectImage('unlit', gmId, meta.rect);
      meta.postConnectors.forEach(({ type, id }) => {// Hide light through doors
        // 🚧 for window should draw polygon i.e. rect without window
        const {rect} = assertDefined(type === 'door' ? gm.doorToLightRect[id] : gm.windowToLightRect[id]);
        state.drawRectImage('unlit', gmId, rect);
      });
      api.renderInto(state.gfx, state.tex[gmId], false);
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
      state.gfx.clear().setTransform();
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
      api.renderInto(state.gfx, state.tex[gmId], false);
    },
    recomputeLights(gmId, roomId) {
      if (!state.unlit[gmId]) {
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
      api.renderInto(state.gfx, state.tex[gmId], false);
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

      state.gfx.clear().setTransform();
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
      api.renderInto(state.gfx, state.tex[gmId], false);
    },
  }));

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <GmSprites
      gms={gms}
      tex={state.tex}
      filters={[colorMatrixFilter]}
    />
  );
}

/**
 * @typedef Props
 * @property {import('./WorldPixi').State} api
 * @property {(doorsApi: State) => void} onLoad
 */

/**
 * @typedef State
 * @property {boolean} ready
 * @property {import('pixi.js').RenderTexture[]} tex
 * @property {import('pixi.js').Texture[]} lit
 * @property {import('pixi.js').Texture[]} unlit
 * @property {import('pixi.js').RenderTexture[]} hit
 * @property {import('@pixi/graphics').Graphics} gfx Reused
 * @property {boolean[][]} isRoomLit Lights on iff `isRoomLit[gmId][roomId]`.
 * 
 * @property {(type: 'lit' | 'unlit', gmId: number, poly: Geom.Poly) => void} drawPolygonImage
 * @property {(type: 'lit' | 'unlit', gmId: number, rect: Geom.RectJson) => void} drawRectImage
 * @property {(gmId: number) => void} initHit
 * @property {(gmId: number) => void} preloadTex
 * @property {(gmId: number) => void} initTex
 * Currently assumes all doors initially closed
 * @property {(gmId: number, roomId: number, lit: boolean)  => void} setRoomLit
 * @property {(gmId: number, doorId: number) => void} onOpenDoor
 * @property {(gmId: number, doorId: number, lightCurrent?: boolean) => void} onCloseDoor
 * @property {(gmId: number, roomId: number)  => void} recomputeLights
 * 
 * //@property {() => void} initDrawIds
 */
