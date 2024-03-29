import React from "react";
import { Mat, Rect } from "../geom";
import { assertNonNull } from "../service/generic";
import { drawLine, fillPolygons } from "../service/dom";
import { gmScale } from "./const";
import useStateRef from "../hooks/use-state-ref";
import GmsCanvas from "./GmsCanvas";

/**
 * 🚧 -> Geomorphs
 */

/** @param {Props} props */
export default function DebugWorld(props) {

  const { api } = props;
  const { gms } = api.gmGraph;

  const state = useStateRef(/** @type {() => State} */ () => ({
    ready: true,
    rootEl: /** @type {HTMLDivElement} */ ({}),
    ctxts: [],
    
    debug: {
      room: undefined,
      gmOutlines: false,
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
      const { debug, ctxts, debug: { room }  } = state;

      gms.forEach((gm, gmId) => {
        const ctxt = ctxts[gmId];
        ctxt.resetTransform();
        ctxt.clearRect(0, 0, ctxt.canvas.width, ctxt.canvas.height);

        ctxt.transform(
          gmScale, 0, 0, gmScale,
          -gmScale * gm.pngRect.x, -gmScale * gm.pngRect.y,
        );
        const baseTransform = ctxt.getTransform();

        if (room?.gmId === gmId) {// Work in local coordinates 
          if (debug.roomNav) {
            ctxt.fillStyle = 'rgba(255, 0, 0, 0.1)';
            ctxt.strokeStyle = 'blue';
            ctxt.lineWidth = 1;
            fillPolygons(ctxt, [room.roomNavPoly], true);
            ctxt.strokeStyle = 'red';
            room.visDoorIds.forEach(doorId =>
              drawLine(ctxt, ...room.gm.doors[doorId].seg)
            );
          }
          if (debug.roomOutline) {
            ctxt.fillStyle = 'rgba(0, 0, 255, 0.1)';
            ctxt.strokeStyle = 'red';
            fillPolygons(ctxt, [room.roomPoly], true);
          }
          if (debug.windowOutlines) {
            ctxt.fillStyle = '#0000ff40';
            ctxt.strokeStyle = 'white';
            const rotAbout = new Mat;
            room.gm.windows.forEach(({ baseRect, angle }, i) => {
              ctxt.transform(...rotAbout.setRotationAbout(angle, baseRect).toArray());
              ctxt.fillRect(baseRect.x, baseRect.y, baseRect.width, baseRect.height);
              ctxt.strokeRect(baseRect.x, baseRect.y, baseRect.width, baseRect.height);
              ctxt.setTransform(baseTransform);
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
        ctxt.transform(...gm.inverseMatrix.toArray());
        
        if (debug.gmOutlines) {
          ctxt.strokeStyle = 'green';
          ctxt.lineWidth = 4;
          ctxt.strokeRect(gm.gridRect.x, gm.gridRect.y, gm.gridRect.width, gm.gridRect.height);
        }

        // Nav paths
        state.pathsByGmId[gmId].forEach(({ ctxt: navPathCtxt, worldRect }) => {
          ctxt.drawImage(
            navPathCtxt.canvas,
            worldRect.x, worldRect.y, worldRect.width, worldRect.height,
          );
        });

      });

    },
    updateDebugRoom() {
      const { gmGraph, fov: { gmId, roomId } } = api;
      const gm = gmGraph.gms[gmId];
      const visDoorIds = api.doors.getVisibleIds(gmId);
      const roomNavPoly = gm.lazy.roomNavPoly[roomId];
      const roomPoly = gm.rooms[roomId];
      state.debug.room = {
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
    <div className="debug">
      <GmsCanvas
        canvasRef={(el, gmId) => state.ctxts[gmId] = assertNonNull(el.getContext('2d'))}
        gms={gms}
        scaleFactor={gmScale}
      />
    </div>
  );
}

/**
 * @typedef Props
 * @property {boolean} [canClickArrows]
 * @property {boolean} [localNav]
 * @property {boolean} [gmOutlines]
 * @property {boolean} [localOutline]
 * @property {boolean} [windows]
 * @property {import('../world/World').State} api
 * @property {(debugApi: State) => void} onLoad
 */

/**
 * @typedef State
 * @property {boolean} ready
 * @property {HTMLDivElement} rootEl
 * @property {CanvasRenderingContext2D[]} ctxts
 * @property {DebugOpts} debug
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
 * @property {boolean} gmOutlines Show gridRect of every geomorph?
 * @property {boolean} windowOutlines Show window outlines in current geomorph? 
 * @property {boolean} roomNav Show room navmesh?
 * @property {boolean} roomOutline Show room outline?
 * Nav path(s) by gmId; aligned to `gms`
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
