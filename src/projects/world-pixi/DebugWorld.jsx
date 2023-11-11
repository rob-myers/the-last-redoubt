import React from "react";
import { RenderTexture, Matrix, Texture } from "@pixi/core";
import { Graphics } from "@pixi/graphics";

import { Mat, Rect } from "../geom";
import { defaultNpcInteractRadius, gmScale } from "../world/const";
import useStateRef from "../hooks/use-state-ref";
import GmSprites from "./GmSprites";
// import GmsCanvas from "./GmsCanvas";

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
      debug: false,
      debugPlayer: false,
      gmOutlines: false,
      roomNav: false,
      roomOutline: false,
      windowOutlines: false,
      interactRadius: defaultNpcInteractRadius,
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
      ctxt.lineWidth = 1;
      ctxt.lineJoin = 'bevel';
      ctxt.setLineDash([4, 4]);
      ctxt.translate(-worldRect.x, -worldRect.y);
      ctxt.moveTo(path[0].x, path[0].y);
      path.forEach(p => ctxt.lineTo(p.x, p.y));
      ctxt.stroke();

      state.pathByKey[key] = { key, ctxt, worldRect, gmIds };
      gmIds.forEach(gmId => state.pathsByGmId[gmId].push(state.pathByKey[key]));
    },
    removeNavPath(key) {
      state.pathByKey[key]?.gmIds.forEach(gmId =>
        state.pathsByGmId[gmId] = state.pathsByGmId[gmId].filter(x => x.key !== key)
      );
      delete state.pathByKey[key];
    },
    render() {
      const { gmGraph: { gms } } = api;
      const { opts: debug, opts: { room }  } = state;
      const gfx = state.gfx;
      const matrix = new Matrix();
      
      gms.forEach((gm, gmId) => {
        gfx.setTransform().clear();
        
        matrix.set(gmScale, 0, 0, gmScale, -gm.pngRect.x * gmScale, -gm.pngRect.y * gmScale);
        gfx.transform.setFromMatrix(matrix);
        // const baseTransform = gfx.getTransform();

        if (room?.gmId === gmId) {// Work in local coordinates 
          if (debug.roomNav) {
            gfx.lineStyle({ color: 'blue', width: 1 });
            gfx.beginFill([255, 0, 0, 0.1]);
            gfx.drawPolygon(room.roomNavPoly.outline);
            gfx.endFill()
            gfx.lineStyle({ color: 'red' });
            room.visDoorIds.forEach(doorId => {
              const [u, v] = room.gm.doors[doorId].seg;
              gfx.moveTo(u.x, u.y);
              gfx.lineTo(v.x, v.y);
            });
          }
          if (debug.roomOutline) {
            gfx.lineStyle({ color: 'red' });
            gfx.beginFill([0, 0, 255, 0.1]);
            gfx.drawPolygon(room.roomPoly.outline);
            gfx.endFill();
          }
          if (debug.windowOutlines) {
            gfx.lineStyle({ color: 'white' });
            room.gm.windows.forEach(({ baseRect, angle, poly }, i) => {
              gfx.beginFill('#0000ff40');
              gfx.drawPolygon(poly.outline);
              gfx.endFill();
            });
          }
        }

        /**
         * The inverseMatrix allows us to draw in world coords.
         * - World coords will be transformed to local geomorph coords, then back by canvas transform.
         * - e.g. sometimes already have world coords: gridRect or navPaths.
         * - e.g. sometimes we have local coords and want to do many fillTexts,
         *   without individually transforming them (door/roomIds).
         */
        // gfx.transform(...gm.inverseMatrix.toArray());
        gfx.transform.setFromMatrix(matrix.append(new Matrix(...gm.inverseMatrix.toArray())));
        
        if (debug.gmOutlines) {
          gfx.lineStyle({ color: 'green', width: 4 })
          gfx.drawRect(gm.gridRect.x, gm.gridRect.y, gm.gridRect.width, gm.gridRect.height);
        }

        // Nav paths
        state.pathsByGmId[gmId].forEach(({ ctxt: navPathCtxt, worldRect }) => {
          // 🚧 textures instead of canvas ctxt
          gfx.beginTextureFill({ texture: Texture.from(navPathCtxt.canvas) });
          gfx.drawRect(worldRect.x, worldRect.y, worldRect.width, worldRect.height);
          gfx.endFill();
        });

        api.pixiApp.renderer.render(gfx, { renderTexture: state.tex[gmId] });
      });

    },
    updateDebugRoom() {
      const { gmGraph, fov: { gmId, roomId } } = api;
      const gm = gmGraph.gms[gmId];
      const visDoorIds = api.doors.getVisibleIds(gmId);
      const roomNavPoly = gm.lazy.roomNavPoly[roomId];
      const roomPoly = gm.rooms[roomId];
      state.opts.room = {
        gmId,
        roomId,
        gm,
        visDoorIds,
        roomNavPoly,
        roomPoly,
      };
      state.render();
    },
  }));

  // 🚧 migrate via hit-test canvas
  // https://github.com/ericdrowell/concrete/blob/1b431ad60fee170a141c85b3a511e9edc2e5a11b/src/concrete.js#L404
  //
  // /* eslint-disable react-hooks/rules-of-hooks */
  // const onClick = React.useCallback(/** @param {React.MouseEvent<HTMLDivElement>} e */ async (e) => {
  //   const target = (/** @type {HTMLElement} */ (e.target));
  //   if (ctxt && target.classList.contains('debug-door-arrow')) {// Manual light control
  //     const doorId = Number(target.dataset.debugDoorId);
  //     if (!ctxt.gm.isHullDoor(doorId)) {
  //       fov.setRoom(gmId, ctxt.gm.getOtherRoomId(doorId, roomId), doorId);
  //       return;
  //     }
  //     const roomCtxt = gmGraph.getAdjacentRoomCtxt(gmId, doorId);
  //     if (roomCtxt) {
  //       fov.setRoom(roomCtxt.adjGmId, roomCtxt.adjRoomId, roomCtxt.adjDoorId);
  //     } else {
  //       console.info(`gm ${gmId}: hull door ${doorId} is isolated`);
  //     }
  //   }

  // }, [ctxt, props, gmId, roomId]);
  // const debugDoorArrowMeta = JSON.stringify({ ui: true, debug: true, 'door-arrow': true });

  React.useEffect(() => {
    state.render();
    props.onLoad(state);
  }, []);
  return (
    <GmSprites
      gms={gms}
      tex={state.tex}
    />
  );
}

/**
 * @typedef Props
 * @property {boolean} [canClickArrows]
 * @property {boolean} [localNav]
 * @property {boolean} [gmOutlines]
 * @property {boolean} [localOutline]
 * @property {boolean} [windows]
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
 * @property {(key: string) => void} removeNavPath
 * @property {() => void} updateDebugRoom
 * @property {() => void} render
 */

/**
 * @typedef DebugOpts
 * @property {DebugRoomCtxt | undefined} room Current-room-specific data
 * @property {boolean} debug
 * @property {boolean} debugPlayer
 * @property {boolean} gmOutlines Show gridRect of every geomorph?
 * @property {boolean} windowOutlines Show window outlines in current geomorph? 
 * @property {boolean} roomNav Show room navmesh?
 * @property {boolean} roomOutline Show room outline?
 * @property {number} interactRadius
 */

/**
 * @typedef DebugRenderPath
 * @property {string} key
 * @property {Geom.Rect} worldRect
 * @property {CanvasRenderingContext2D} ctxt
 * @property {Set<number>} gmIds
 */

/**
 * @typedef DebugRoomCtxt
 * @property {number} gmId
 * @property {number} roomId
 * @property {Geomorph.GeomorphDataInstance} gm
 * @property {number[]} visDoorIds
 * @property {Geom.Poly} roomNavPoly
 * @property {Geom.Poly} roomPoly
 */
