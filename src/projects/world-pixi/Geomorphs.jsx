import React from "react";
import { useQueries } from "@tanstack/react-query";

import { Assets } from "@pixi/assets";
import { RenderTexture, Rectangle, BLEND_MODES } from "@pixi/core";
import { Graphics } from "@pixi/graphics";

import { Poly } from "../geom";
import { assertDefined } from "../service/generic";
import { debugDoorOffset, decorIconRadius, gmScale, hitTestRed } from "../world/const";
import useStateRef from "../hooks/use-state-ref";
import { colMatFilter1, tempMatrix1 } from "./Misc";
import GmSprites from "./GmSprites";

/**
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { api } = props;
  const { gmGraph: { gms } } = api;

  const loaded = useQueries({
    /** @type {import("@tanstack/react-query").QueriesOptions<void>} */
    queries: gms.map((gm, gmId) => ({
      queryKey: [`${gm.key}.${gmId}`], // gmId for dups
      queryFn: async () => {
        state.preloadTex(gmId);
        await Promise.all(/** @type {const} */ (['lit', 'unlit']).map(async type =>
          state[type][gmId] = await Assets.load(// 🚧 .webp -> .unlit.webp
            `/assets/geomorph/${gm.key}${type === 'unlit' ? '.webp' : `.${type}.webp`}`
          )
        ));
        state.initTex(gmId);
        api.doors.initTex(gmId);
        api.decor.initLookups(gmId);
        api.decor.initTex(gmId);
        state.initHit(gmId);
        return null;
      },
      throwOnError: true,
      gcTime: Infinity,
      staleTime: Infinity,
      refetchOnMount: 'always',
    })),
    combine: x => x.every(y => y.isSuccess && !y.isFetching),
  });

  const state = useStateRef(/** @type {() => State} */ () => ({
    ready: true,

    lit: [],
    unlit: [],
    gfx: new Graphics(),
    
    tex: gms.map(gm => RenderTexture.create({ width: gmScale * gm.pngRect.width, height: gmScale * gm.pngRect.height })),
    hit: gms.map(gm => RenderTexture.create({ width: gm.pngRect.width, height: gm.pngRect.height })),

    isRoomLit: gms.map(({ rooms }) => rooms.map(_ => true)),

    clearHitRoom(gmId, roomId) {
      const gm = gms[gmId];
      const radius = decorIconRadius + 1;
      const gfx = state.gfx.clear().setTransform(-gm.pngRect.x, -gm.pngRect.y);
      gfx.blendMode = BLEND_MODES.ERASE;

      // decor points
      const { points } = api.decor.byRoom[gmId][roomId];
      points.forEach((d) => {
        const local = gm.toLocalCoords(d);
        gfx.beginFill('black');
        gfx.drawRect(local.x - radius, local.y - radius, 2 * radius, 2 * radius);
        gfx.endFill();
      });
      
      // canClickArrows (also after set false)
      const { opts } = api.debug;
      if (opts.room && opts.room.gmId === gmId && opts.room.roomId === roomId) {
        opts.room.navArrows.forEach(({ arrowPos }) => {
          gfx.beginFill('black');
          gfx.drawRect(arrowPos.x - radius, arrowPos.y - radius, 2 * radius, 2 * radius);
          gfx.endFill();
        });
      }

      api.renderInto(gfx, api.geomorphs.hit[gmId], false);
      gfx.clear().blendMode = BLEND_MODES.NORMAL;
    },
    drawPolygonImage(type, gmId, poly) {
      const gfx = state.gfx;
      const gm = gms[gmId];
      // Alternatively:
      // - setTransform(-gmScale * gm.pngRect.x, -gmScale * gm.pngRect.y, gmScale, gmScale),
      // - beginTextureFill uses inverse matrix
      gfx.beginTextureFill({ texture: state[type][gmId] });
      gfx.drawPolygon(poly.outline.map(p => ({
        x: gmScale * (p.x - gm.pngRect.x),
        y: gmScale * (p.y - gm.pngRect.y),
      })));
      gfx.endFill();
    },
    drawRectImage(type, gmId, rect) {
      const gfx = state.gfx;
      gfx.beginTextureFill({ texture: state[type][gmId] });
      gfx.drawRect(// Src/target canvas are scaled by `gmScale`
        gmScale * (rect.x - gms[gmId].pngRect.x),
        gmScale * (rect.y - gms[gmId].pngRect.y),
        gmScale * rect.width,
        gmScale * rect.height,
      );
      gfx.endFill();
    },
    getHitMeta(worldPoint) {
      const [gmId] = api.gmGraph.findGeomorphIdContaining(worldPoint)
      if (gmId === null) {
        return null; // Outside World bounds 
      }
      const gm = api.gmGraph.gms[gmId];
      const local = gm.inverseMatrix.transformPoint({...worldPoint});
      const [r, g, b, _a] = Array.from(api.extract.pixels(
        api.geomorphs.hit[gmId],
        new Rectangle(local.x - gm.pngRect.x - 1, local.y - gm.pngRect.y - 1, 1, 1),
      ));

      switch (r) {// Decode data previously drawn into `state.hit`
        case hitTestRed.door:
          return /** @type {Geomorph.PointMeta} */ ({ door: true, gmId, doorId: b });
        case hitTestRed.decorPoint: {
          const decor = api.decor.byRoom[gmId][g].points[b];
          if (!decor) {
            console.error(`decor not found: g${gmId}r${g}p${b}`);
            return null;
          }
          return /** @type {Geomorph.PointMeta} */ ({ decor: true, gmId, roomId: g, decorKey: decor.key });
        }
        case hitTestRed.debugArrow:
          return /** @type {Geomorph.PointMeta} */ ({ debug: true, debugArrow: true, gmId, roomId: g, doorId: b });
        default:
          // if (a > 0) console.log('pointermove', gmId, local, [r, g, b, a]);
          return null;
      }
    },
    initHit(gmId) {
      gms[gmId].rooms.forEach((_, roomId) => state.renderHitRoom(gmId, roomId));
    },
    initTex(gmId) {
      //  image -> image
      const gfx = state.gfx.clear().setTransform();
      const gm = gms[gmId];

      // draw entire lit geomorph
      gfx.beginTextureFill({ texture: state.lit[gmId] });
      gfx.drawRect(0, 0, gm.pngRect.width * gmScale, gm.pngRect.height * gmScale);
      gfx.endFill();

      // draw unlit polys when light blocked by some door
      const lookup = api.doors.lookup[gmId];
      gm.lightThrus.forEach(x => {
        if (x.windowId === -1 && !(lookup[x.doorId].open && x.preConnectors.every(y => lookup[y.id].open))) {
          // state.drawRectImage('unlit', gmId, x.rect);
          state.drawPolygonImage('unlit', gmId, x.poly);
        }
      });
      api.renderInto(gfx, state.tex[gmId]);
    },
    onCloseDoor(gmId, doorId) {
      const gm = gms[gmId];
      const meta = gm.doorToLightThru[doorId];
      if (!meta) {
        return;
      }
      state.gfx.clear().setTransform();
      // Hide light by drawing partial image
      state.drawPolygonImage('unlit', gmId, meta.poly);
      meta.postConnectors.forEach(({ type, id }) => {// Hide light through doors
        // 🚧 handle windows properly?
        const { poly } = assertDefined(type === 'door' ? gm.doorToLightThru[id] : gm.windowToLightThru[id]);
        state.drawPolygonImage('unlit', gmId, poly);
      });
      api.renderInto(state.gfx, state.tex[gmId], false);
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
      state.gfx.clear().setTransform();
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
      api.renderInto(state.gfx, state.tex[gmId], false);
    },
    preloadTex(gmId) {
      const gm = gms[gmId];
      const gfx = state.gfx.clear();
      gfx.transform.setFromMatrix(tempMatrix1.set(gmScale, 0, 0, gmScale, -gm.pngRect.x * gmScale, -gm.pngRect.y * gmScale));
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
    renderHitRoom(gmId, roomId) {
      const gm = gms[gmId];
      const gfx = state.gfx.clear().setTransform(-gm.pngRect.x, -gm.pngRect.y);
      
      // decor in room
      const { points } = api.decor.byRoom[gmId][roomId];
      const radius = decorIconRadius + 1;
      points.forEach((d, pointId) => {
        const center = gm.toLocalCoords(d);
        // Assuming ≤ 256 DecorPoints in a room
        gfx.beginFill(`rgba(${hitTestRed.decorPoint}, ${roomId}, ${pointId}, 1)`);
        gfx.drawCircle(center.x, center.y, radius);
        gfx.endFill();
      });

      // canClickArrows
      const { opts } = api.debug;
      if (opts.canClickArrows && opts.room && opts.room.gmId === gmId && opts.room.roomId === roomId) {
        opts.room.navArrows.forEach(({ doorId, arrowPos }) => {
          gfx.beginFill(`rgba(${hitTestRed.debugArrow}, ${roomId}, ${doorId}, 1)`);
          gfx.drawCircle(arrowPos.x, arrowPos.y, radius);
          gfx.endFill();
        });
      }

      // doors adjacent to room
      gm.roomGraph.getAdjacentDoors(roomId).forEach(({ doorId }) => {
        const { poly, seg: [u, v], normal } = gm.doors[doorId];
        // Assuming ≤ 256 doors in a geomorph
        gfx.beginFill(`rgba(${hitTestRed.door}, 0, ${doorId}, 1)`);
        gfx.drawPolygon([
          u.clone().addScaledVector(normal, 4),
          v.clone().addScaledVector(normal, 4),
          v.clone().addScaledVector(normal, -4),
          u.clone().addScaledVector(normal, -4),
        ]);
        gfx.endFill();
      });

      api.renderInto(gfx, state.hit[gmId], false);
    },
    setRoomLit(gmId, roomId, nextLit) {
      const gm = gms[gmId];
      if (
        state.isRoomLit[gmId][roomId] === nextLit
        || !gm.lightSrcs.some(x => x.roomId === roomId)
      ) {
        return;
      }

      state.isRoomLit[gmId][roomId] = nextLit;

      const doors = gm.roomGraph.getAdjacentDoors(roomId).map(x => api.doors.lookup[gmId][x.doorId]);
      const windowLightRects = gm.roomGraph.getAdjacentWindows(roomId).flatMap(
        x => gm.windowToLightThru[x.windowId] ?? [],
      );
        
      state.gfx.clear().setTransform();
      if (nextLit) {
        state.drawPolygonImage('lit', gmId, gm.roomsWithDoors[roomId]);
        windowLightRects.forEach(({ rect }) => state.drawRectImage('lit', gmId, rect));
        api.renderInto(state.gfx, state.tex[gmId], false);
        doors.forEach(({ open, doorId }) =>
          open && (roomId === gm.doorToLightThru[doorId]?.srcRoomId)
            // If door open AND light comes from roomId, open it to emit light thru doorway
            ? state.onOpenDoor(gmId, doorId)
            // Otherwise must close door to rub out light from other rooms.
            : state.onCloseDoor(gmId, doorId)
        );
      } else {
        state.drawPolygonImage('unlit', gmId, gm.roomsWithDoors[roomId]);
        windowLightRects.forEach(({ rect, windowId }) => {
          const [poly] = Poly.cutOut([gm.windows[windowId].poly], [Poly.fromRect(rect)]);
          state.drawPolygonImage('unlit', gmId, poly);
        });
        api.renderInto(state.gfx, state.tex[gmId], false);
        doors.forEach(({ doorId, open }) =>
          open && (roomId !== gm.doorToLightThru[doorId]?.srcRoomId)
            // If door open AND light not from roomId, open it to emit light thru doorway.
            ? state.onOpenDoor(gmId, doorId)
            // Otherwise must close door to rub out light from roomId
            : state.onCloseDoor(gmId, doorId)
        );
      }
    },
  }));

  React.useEffect(() => {
    loaded && props.onLoad(state);
  }, [loaded]);

  return (
    <GmSprites
      gms={gms}
      tex={state.tex}
      filters={[colMatFilter1]}
      visible={api.visibleGms}
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
 * @property {(gmId: number, roomId: number) => void} clearHitRoom
 * @property {(type: 'lit' | 'unlit', gmId: number, poly: Geom.Poly) => void} drawPolygonImage
 * @property {(type: 'lit' | 'unlit', gmId: number, rect: Geom.RectJson) => void} drawRectImage
 * @property {(gmId: number) => void} initHit
 * @property {(gmId: number) => void} preloadTex
 * @property {(gmId: number) => void} initTex
 * @property {(gmId: number, roomId: number) => void} renderHitRoom
 * @property {(gmId: number, roomId: number, lit: boolean)  => void} setRoomLit
 * @property {(worldPoint: Geom.VectJson)  => null | Geomorph.PointMeta} getHitMeta
 * @property {(gmId: number, doorId: number) => void} onOpenDoor
 * @property {(gmId: number, doorId: number) => void} onCloseDoor
 * @property {(gmId: number, roomId: number)  => void} recomputeLights
 * 
 * //@property {() => void} initDrawIds
 */
