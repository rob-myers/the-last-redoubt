import React from "react";
import { RenderTexture, Matrix, Texture } from "@pixi/core";
import { Graphics } from "@pixi/graphics";

import { Poly, Rect } from "../geom";
import { debugArrowAlpha, debugDoorOffset, debugArrowRadius, defaultNpcInteractRadius, gmScale } from "../world/const";
import useStateRef from "../hooks/use-state-ref";
import GmSprites from "./GmSprites";

/** @param {Props} props */
export default function DebugWorld(props) {
  const { api } = props;
  const { gms } = api.gmGraph;

  const state = useStateRef(/** @type {() => State} */ () => ({
    ready: true,
    tex: gms.map(gm => RenderTexture.create({
      width: gmScale * gm.pngRect.width,
      height: gmScale * gm.pngRect.height,
    })),
    gfx: new Graphics(),
    
    opts: {
      room: undefined,
      canClickArrows: false,
      debug: false,
      debugHit: false,
      debugPlayer: false,
      gmOutlines: false,
      interactRadius: defaultNpcInteractRadius,
      labels: false,
      roomColliders: false,
      roomNav: false,
      roomOutline: false,
      windowOutlines: false,
    },
    pathByKey: {},
    pathsByGmId: gms.map(_ => []),

    addNavPath(key, navPath) {
      state.removeNavPath(key);
      const path = navPath.path;
      if (path.length === 0) {
        return;
      }

      const ctxt = /** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d'));
      const worldRect = Rect.fromPoints(...path).outset(2);
      const gmIds = api.lib.getNavPathGmIds(navPath);

      // Draw navpath once in own canvas
      ctxt.canvas.width = worldRect.width;
      ctxt.canvas.height = worldRect.height;
      ctxt.strokeStyle = '#ffffff33';
      // ctxt.strokeStyle = '#ff0000';
      ctxt.lineWidth = 1;
      ctxt.lineJoin = 'bevel';
      ctxt.setLineDash([4, 4]);
      ctxt.translate(-worldRect.x, -worldRect.y);
      ctxt.moveTo(path[0].x, path[0].y);
      path.forEach(p => ctxt.lineTo(p.x, p.y));
      ctxt.stroke();

      state.pathByKey[key] = { key, worldRect, gmIds, texture: Texture.from(ctxt.canvas) };
      gmIds.forEach(gmId => state.pathsByGmId[gmId].push(state.pathByKey[key]));
    },
    onClick(e) {
      const { room } = state.opts;
      if (e.meta.debugArrow && room) {
        const doorId = Number(e.meta.doorId);
        if (!room.gm.isHullDoor(doorId)) {
          return api.fov.setRoom(room.gmId, room.gm.getOtherRoomId(doorId, room.roomId), doorId);
        }
        const ctxt = api.gmGraph.getAdjacentRoomCtxt(room.gmId, doorId);
        if (ctxt) {
          return api.fov.setRoom(ctxt.adjGmId, ctxt.adjRoomId, ctxt.adjDoorId);
        }
        console.info(`gm ${room.gmId}: hull door ${doorId} is isolated`);
      }
    },
    removeNavPath(key) {
      state.pathByKey[key]?.gmIds.forEach(gmId =>
        state.pathsByGmId[gmId] = state.pathsByGmId[gmId].filter(x => x.key !== key)
      );
      state.pathByKey[key]?.texture?.destroy();
      delete state.pathByKey[key];
    },
    render() {
      const { gmGraph: { gms } } = api;
      const { opts, opts: { room } } = state;
      const matrix = new Matrix();
      const gfx = state.gfx;

      gms.forEach((gm, gmId) => {
        api.renderInto(gfx.clear(), state.tex[gmId]);

        if (opts.debugHit) {
          gfx.setTransform(0, 0, gmScale, gmScale);
          gfx.beginTextureFill({ texture: api.geomorphs.hit[gmId], alpha: 0.2 });
          gfx.drawRect(0, 0, gm.pngRect.width, gm.pngRect.height);
          gfx.endFill();
          api.renderInto(gfx, state.tex[gmId], false);
        }

        // Draw in local geomorph coords
        matrix.set(gmScale, 0, 0, gmScale, -gm.pngRect.x * gmScale, -gm.pngRect.y * gmScale);
        gfx.clear().setTransform(-gm.pngRect.x * gmScale, -gm.pngRect.y * gmScale, gmScale, gmScale);
        
        if (room?.gmId === gmId) {
          if (opts.roomNav) {
            gfx.lineStyle({ color: 'blue', width: 1 });
            gfx.beginFill([255, 0, 0, 0.1]);
            gfx.drawPolygon(room.roomNavPoly.outline);
            gfx.endFill()
            // gfx.lineStyle({ color: 'red', width: 1 });
            // room.adjDoorIds.forEach(doorId => {
            //   const [u, v] = room.gm.doors[doorId].seg;
            //   gfx.moveTo(u.x, u.y);
            //   gfx.lineTo(v.x, v.y);
            // });
          }
          if (opts.roomOutline) {
            gfx.lineStyle({ width: 0 });
            gfx.beginFill([0, 0, 255, 0.1]);
            gfx.drawPolygon(room.roomPoly.outline);
            gfx.endFill();
          }
          if (opts.windowOutlines) {
            gfx.lineStyle({ color: 'white', width: 1 });
            room.gm.windows.forEach(({ baseRect, angle, poly }, i) => {
              gfx.beginFill('#0000ff40');
              gfx.drawPolygon(poly.outline);
              gfx.endFill();
            });
          }

          // Arrows (always drawn, optionally clickable)
          const texture = api.decor.sheet.lookup["circle-right"];
          const scale = (2 * debugArrowRadius) / texture.frame.width;
          
          gfx.lineStyle({ width: 0 });
          room.navArrows.forEach(({ arrowPos, angle }) => {
            gfx.beginTextureFill({
              texture,
              matrix: tempMatrix.identity()
                .translate(-texture.width/2, -texture.height/2).rotate(angle).translate(texture.width/2, texture.height/2)
                .scale(scale, scale).translate(arrowPos.x - debugArrowRadius, arrowPos.y - debugArrowRadius),
              alpha: debugArrowAlpha,
            });
            gfx.drawRect(arrowPos.x - debugArrowRadius, arrowPos.y - debugArrowRadius, 2 * debugArrowRadius, 2 * debugArrowRadius);
            gfx.endFill();
          });
          api.geomorphs.renderHitRoom(gmId, room.roomId);

        }

        api.renderInto(gfx, state.tex[gmId], false);
        
        // Draw in world coords
        const multiplied = matrix.append(new Matrix(...gm.inverseMatrix.toArray()));
        gfx.clear().transform.setFromMatrix(multiplied);
        
        if (room?.gmId === gmId) {
          if (opts.roomColliders) {// 🚧 Cache computation
            const roomPoly = gm.roomsWithDoors[room.roomId].clone().applyMatrix(gm.matrix);
            const { colliders } = api.decor.byRoom[gmId][room.roomId];
            const intersects = Poly.intersect(colliders.map(x =>
              x.type === 'rect'
                ? /** @type {Geom.Poly} */ (x.derivedPoly)
                : Poly.circle(x.center, x.radius, 32)
            ), [roomPoly]);
            intersects.forEach(poly => {
              gfx.beginFill(0x00ff00, 0.1); gfx.drawPolygon(poly.outline); gfx.endFill();
            });
          }
        }

        // Nav paths
        state.pathsByGmId[gmId].forEach(({ worldRect, texture }) => {
          gfx.beginTextureFill({ texture, matrix: tempMatrix.set(1, 0, 0, 1, worldRect.x, worldRect.y) });
          gfx.drawRect(worldRect.x, worldRect.y, worldRect.width, worldRect.height);
          gfx.endFill();
          // gfx.beginFill(0, 0).lineStyle({ width: 2, color: 0xff0000 });
          // gfx.drawRect(worldRect.x, worldRect.y, worldRect.width, worldRect.height);
          // gfx.endFill();
        });

        api.renderInto(gfx, state.tex[gmId], false);
      });
    },
    updateDebugRoom() {
      const { gmGraph, fov: { gmId, roomId } } = api;
      const gm = gmGraph.gms[gmId];

      const prevRoom = state.opts.room;
      const adjDoorIds = gm.roomGraph.getAdjacentDoors(roomId).map(x => x.doorId);
      state.opts.room = {
        gmId,
        roomId,
        gm,
        adjDoorIds,
        navArrows: adjDoorIds.map(doorId => {
          const { poly, normal, roomIds } = gm.doors[doorId];
          /** Have seen hull doors where normal is "inverted" */
          const sign = roomIds[0] === roomId ? 1 : -1;
          const arrowPos = poly.center.addScaledVector(normal, sign * debugDoorOffset);
          const { angle } = normal.clone().scale(-sign);
          return { doorId, arrowPos, angle };
        }),
        roomNavPoly: gm.lazy.roomNavPoly[roomId],
        roomPoly: gm.rooms[roomId],
      };

      // canClickArrows modifies hit canvas
      prevRoom && api.geomorphs.renderHitRoom(prevRoom.gmId, prevRoom.roomId);
      state.render();
    },
  }));

  React.useEffect(() => {
    process.env.NODE_ENV === 'development' && api.isReady() && state.render();
    props.onLoad(state);
  }, []);

  return (
    <GmSprites
      gms={gms}
      tex={state.tex}
      visible={api.visibleGms}
    />
  );
}

/**
 * @typedef Props
 * @property {import('./WorldPixi').State} api
 * @property {(debugApi: State) => void} onLoad
 */

/**
 * @typedef State
 * @property {boolean} ready
 * @property {import('pixi.js').RenderTexture[]} tex
 * @property {import('pixi.js').Graphics} gfx
 * @property {DebugOpts} opts
 * @property {Record<string, DebugRenderPath>} pathByKey Nav path by key
 * @property {Record<number, DebugRenderPath[]>} pathsByGmId
 * 
 * @property {(key: string, navPath: NPC.GlobalNavPath) => void} addNavPath
 * @property {(e: PanZoom.PointerUpEvent) => void} onClick
 * @property {(key: string) => void} removeNavPath
 * @property {() => void} updateDebugRoom
 * @property {() => void} render
 */

/**
 * @typedef DebugOpts
 * @property {DebugRoomCtxt | undefined} room Current-room-specific data
 * @property {boolean} canClickArrows
 * @property {boolean} debug
 * @property {boolean} debugHit
 * @property {boolean} debugPlayer
 * @property {boolean} gmOutlines Show gridRect of every geomorph?
 * @property {number} interactRadius
 * @property {boolean} labels
 * @property {boolean} roomColliders Show room colliders (intersected against room)?
 * @property {boolean} roomNav Show room navmesh?
 * @property {boolean} roomOutline Show room outline?
 * @property {boolean} windowOutlines Show window outlines in current geomorph? 
 */

/**
 * @typedef DebugRenderPath
 * @property {string} key
 * @property {Set<number>} gmIds
 * @property {Texture} texture
 * @property {Geom.Rect} worldRect
 */

/**
 * @typedef DebugRoomCtxt
 * @property {number} gmId
 * @property {number} roomId
 * @property {Geomorph.GeomorphDataInstance} gm
 * @property {number[]} adjDoorIds
 * @property {{ doorId: number; arrowPos: Geom.VectJson; angle: number; }[]} navArrows
 * @property {Geom.Poly} roomNavPoly
 * @property {Geom.Poly} roomPoly
 */

const tempMatrix = new Matrix;
