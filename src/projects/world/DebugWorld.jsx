import React from "react";
import { css, cx } from "@emotion/css";
import { Mat, Rect } from "../geom";
import { drawLine, fillPolygons } from "../service/dom";
import { cssName, wallOutset } from "./const";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * 🚧 draw to canvases instead
 */

/** @param {Props} props */
export default function DebugWorld(props) {

  const update = useUpdate();
  const { api } = props;
  const { gms } = api.gmGraph;

  const state = useStateRef(/** @type {() => State} */ () => ({
    ready: true,
    rootEl: /** @type {HTMLDivElement} */ ({}),
    ctxts: [],
    idCtxts: [],
    room: undefined,

    tree: {
      gmOutlines: false,
      roomNav: false,
      roomOutline: false,
      pathByKey: {},
      pathsByGmId: gms.map(_ => []),
    },

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

      state.tree.pathByKey[key] = { key, ctxt, worldRect, gmIds };
      gmIds.forEach(gmId => state.tree.pathsByGmId[gmId].push(state.tree.pathByKey[key]));
    },
    removeNavPath(key) {
      state.tree.pathByKey[key]?.gmIds.forEach(gmId =>
        state.tree.pathsByGmId[gmId] = state.tree.pathsByGmId[gmId].filter(x => x.key !== key)
      );
      delete state.tree.pathByKey[key];
    },
    changeRoom() {
      const { gmGraph, fov: { gmId, roomId } } = api;
      const gm = gmGraph.gms[gmId];
      const visDoorIds = api.doors.getVisibleIds(gmId);
      const roomNavPoly = gm.lazy.roomNavPoly[roomId];
      /** Outset for door lines (? it fixed something) */
      const outsetRoomNavAabb = roomNavPoly.rect.outset(wallOutset);
      const roomAabb = gm.rooms[roomId].rect;
      const roomPoly = gm.rooms[roomId];
      state.room = {
        gmId,
        roomId,
        gm,
        visDoorIds,
        roomNavPoly,
        outsetRoomNavAabb,
        roomAabb,
        roomPoly,
      };
      state.render();
    },
    drawIds() {
      const { gmGraph: { gms } } = api;
      state.idCtxts = gms.map((gm, gmId) => {
        const canvas = document.createElement('canvas');
        canvas.width = gm.pngRect.width * 2;
        canvas.height = gm.pngRect.height * 2;
        return /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
      })

      gms.forEach((gm, gmId) => {
        const ctxt = state.idCtxts[gmId];
        ctxt.resetTransform();
        ctxt.clearRect(0, 0, ctxt.canvas.width, ctxt.canvas.height);
        ctxt.transform(2, 0, 0, 2, -2 * gm.pngRect.x, -2 * gm.pngRect.y);
        ctxt.transform(...gm.inverseMatrix.toArray());

        // gm/room/door ids
        let fontPx = 7;
        const debugIdOffset = 12;
        
        const saved = ctxt.getTransform();
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
          ctxt.setTransform(saved);
          
          roomIds.forEach((roomId, i) => {
            if (roomId === null) return;
            ctxt.font = `${fontPx = 7}px Courier New`;
            const roomText = gm.isHullDoor(doorId) ? `${gmId} ${roomId}` : `${roomId}`;
            const textWidth = ctxt.measureText(roomText).width;
            const idPos = center.clone()
              .addScaledVector(normal, (i === 0 ? 1 : -1) * debugIdOffset)
              .translate(-textWidth/2, -fontPx/2)
            ;
            ctxt.fillStyle = '#ffffff88';
            ctxt.fillText(roomText, idPos.x, idPos.y);
          });
        });
      });
    },
    render() {
      const { gmGraph: { gms } } = api;
      const { tree, ctxts, room } = state;
      if (!room) return;

      gms.forEach((gm, gmId) => {
        const ctxt = ctxts[gmId];
        ctxt.resetTransform();
        ctxt.clearRect(0, 0, ctxt.canvas.width, ctxt.canvas.height);

        // Draw gm/room/door ids
        ctxt.drawImage(state.idCtxts[gmId].canvas, 0, 0);

        ctxt.transform(2, 0, 0, 2, -2 * gm.pngRect.x, -2 * gm.pngRect.y);

        if (room.gmId === gmId) {// Work in local coordinates 
          if (tree.roomNav) {
            ctxt.fillStyle = 'rgba(255, 0, 0, 0.1)';
            ctxt.strokeStyle = 'blue';
            ctxt.lineWidth = 1;
            fillPolygons(ctxt, [room.roomNavPoly], true);
            ctxt.strokeStyle = 'red';
            room.visDoorIds.forEach(doorId =>
              drawLine(ctxt, ...room.gm.doors[doorId].seg)
            );
          }
  
          if (tree.roomOutline) {
            ctxt.fillStyle = 'rgba(0, 0, 255, 0.1)';
            ctxt.strokeStyle = 'red';
            fillPolygons(ctxt, [room.roomPoly], true);
          }
        }

        /**
         * The inverseMatrix allows us to draw in world coords.
         * - World coords will be transformed to local geomorph coords, then back by canvas transform.
         * - Sometimes we already have world coords: gridRect or navPaths.
         * - Sometimes we have local coords and want to do many fillTexts,
         *   without individually transforming them (door/roomIds).
         */
        ctxt.transform(...gm.inverseMatrix.toArray());
        
        if (tree.gmOutlines) {
          ctxt.strokeStyle = 'green';
          ctxt.lineWidth = 4;
          ctxt.strokeRect(gm.gridRect.x, gm.gridRect.y, gm.gridRect.width, gm.gridRect.height);
        }

        // Nav paths
        tree.pathsByGmId[gmId].forEach(({ ctxt: navPathCtxt, worldRect }) => {
          ctxt.drawImage(
            navPathCtxt.canvas,
            worldRect.x, worldRect.y, worldRect.width, worldRect.height,
          );
        });

      });

    },

    rootRef(el) {
      if (el) {
        state.rootEl = el;
        // 🚧 remove
        !api.debug.ready && [
          cssName.debugHighlightWindows,
        ].forEach(cssVarName =>
          el.style.setProperty(cssVarName, 'none')
        );
      }
    },
    update,
  }));

  // 🚧 migrate later e.g. via hit-test canvas
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
    state.drawIds();
    state.render();
    props.onLoad(state);
  }, []);

  const ctxt = state.room;

  return (
    <div
      className={cx("debug", rootCss)}
      // onClick={onClick}
      ref={state.rootRef}
    >

      {ctxt && (
        <div
          key={ctxt.gm.itemKey}
          className={cx("debug-room", `gm-${ctxt.gmId}`)}
          /** Must transform local ordinates */
          style={{ transform: ctxt.gm.transformStyle }}
        >

          {ctxt.gm.windows.map(({ baseRect, angle }, i) => {
            return (
              <div
                key={`window-${i}`}
                className="debug-window"
                style={{
                  left: baseRect.x,
                  top: baseRect.y,
                  width: baseRect.width,
                  height: baseRect.height,
                  transform: `rotate(${angle}rad)`,
                  ...props.windows && { display: 'initial' },
                }}
              />
            );
          })}

        </div>
      )}
      {/* 🚧 remove above */}

      {gms.map((gm, gmId) =>
        <canvas
          key={gmId}
          ref={(el) => el && (
            state.ctxts[gmId] = /** @type {CanvasRenderingContext2D} */ (el.getContext('2d'))
          )}
          className={`gm-${gmId}`}
          width={gm.pngRect.width * debugCanvasScale}
          height={gm.pngRect.height * debugCanvasScale}
          style={{
            /**
             * - gm.transformStyle applies layout transform
             * - translate by gm.pngRect because PNG may be larger (e.g. hull doors)
             * - scale for higher quality
             */
            transformOrigin: 'top left',
            transform: `${gm.transformStyle} scale(${ 1 / debugCanvasScale }) translate(${debugCanvasScale * gm.pngRect.x}px, ${debugCanvasScale * gm.pngRect.y}px)`,
          }}
        />
      )}
    </div>
  );
}

/** Needn't match gmScale? */
const debugCanvasScale = 2;

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
 * @property {DebugRoomCtxt | undefined} room Current-room-specific data
 * @property {CanvasRenderingContext2D[]} ctxts
 * @property {CanvasRenderingContext2D[]} idCtxts Canvases for gm/room/door ids
 * @property {DebugRenderTree} tree
 * 
 * @property {React.RefCallback<HTMLDivElement>} rootRef
 * @property {(key: string, navPath: NPC.GlobalNavPath) => void} addNavPath
 * @property {(key: string) => void} removeNavPath
 * @property {() => void} changeRoom
 * @property {() => void} drawIds Draw gm/room/door ids
 * @property {() => void} render
 * @property {() => void} update
 */

/**
 * @typedef DebugRenderTree
 * @property {boolean} gmOutlines
 * @property {boolean} roomNav
 * @property {boolean} roomOutline
 * @property {Record<string, DebugRenderPath>} pathByKey
 * @property {Record<number, DebugRenderPath[]>} pathsByGmId Aligned to `gms`
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
 * @property {Geom.Rect} outsetRoomNavAabb
 * @property {Geom.Rect} roomAabb
 * @property {Geom.Poly} roomPoly
 */

const rootCss = css`
  canvas {
    position: absolute;
    pointer-events: none;
  }

  // 🚧 old below
  div.debug-room {
    position: absolute;

    div.debug-window {
      display: var(${cssName.debugHighlightWindows});
      position: absolute;
      background: #0000ff40;
      border: 1px solid white;
      pointer-events: none;
      transform-origin: top left;
    }
  }  
`;
