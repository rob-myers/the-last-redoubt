import React from "react";
import { css, cx } from "@emotion/css";
import { Rect, Vect } from "../geom";
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

  const state = useStateRef(/** @type {() => State} */ () => {
    return {
      ready: true,
      rootEl: /** @type {HTMLDivElement} */ ({}),
      ctxts: [],
      room: undefined,

      tree: {
        gmOutlines: false,
        roomNav: false,
        roomOutline: false,
        path: {},
        pathsByGmId: gms.map(_ => []),
      },

      addNavPath(key, navPath) {
        state.removeNavPath(key);
        
        const path = navPath.path;
        if (path.length === 0) {
          return;
        }

        const ctxt = /** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d'));
        const worldRect = Rect.fromPoints(...path).outset(10);
        const gmIds = api.lib.getNavPathGmIds(navPath);

        // Draw navpath once in own canvas
        ctxt.canvas.width = worldRect.width;
        ctxt.canvas.height = worldRect.height;
        ctxt.strokeStyle = 'red';
        ctxt.lineWidth = 1;
        ctxt.translate(-worldRect.x, -worldRect.y);
        ctxt.moveTo(path[0].x, path[0].y);
        path.forEach(p => ctxt.lineTo(p.x, p.y));
        ctxt.stroke();

        state.tree.path[key] = { key, ctxt, worldRect, gmIds };
        gmIds.forEach(gmId => state.tree.pathsByGmId[gmId].push(state.tree.path[key]));
      },
      removeNavPath(key) {
        state.tree.path[key]?.gmIds.forEach(gmId =>
          state.tree.pathsByGmId[gmId] = state.tree.pathsByGmId[gmId].filter(x => x.key !== key)
        );
        delete state.tree.path[key];
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
        const undoNonAffineStyle = `matrix(${gm.inverseMatrix.toArray().slice(0, 4)},0, 0)`;
        state.room = {
          gmId,
          roomId,
          gm,
          visDoorIds,
          roomNavPoly,
          outsetRoomNavAabb,
          roomAabb,
          roomPoly,
          undoNonAffineStyle,
        };
        state.render();
      },

      render() {
        const { gmGraph: { gms } } = api;
        const { tree, ctxts, room } = state;
        if (!room) return;

        gms.forEach((gm, gmId) => {
          const ctxt = ctxts[gmId];
          ctxt.resetTransform();
          ctxt.clearRect(0, 0, ctxt.canvas.width, ctxt.canvas.height);
          ctxt.transform(2, 0, 0, 2, -2 * gm.pngRect.x, -2 * gm.pngRect.y);
          ctxt.transform(...gm.inverseMatrix.toArray());
          
          if (tree.gmOutlines) {
            ctxt.strokeStyle = 'green';
            ctxt.lineWidth = 4;
            ctxt.strokeRect(gm.gridRect.x, gm.gridRect.y, gm.gridRect.width, gm.gridRect.height);
          }

          tree.pathsByGmId[gmId].forEach(({ ctxt: navPathCtxt, worldRect }) => {
            ctxt.drawImage(
              navPathCtxt.canvas,
              worldRect.x, worldRect.y, worldRect.width, worldRect.height,
            );
          });

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

        });

      },
      rootRef(el) {
        if (el) {
          state.rootEl = el;
          // 🚧 remove
          // Styles permits getPropertyValue (vs CSS and getComputedStyle)
          !api.debug.ready && [
            cssName.debugDoorArrowPtrEvts,
            cssName.debugHighlightWindows,
            cssName.debugShowIds,
            cssName.debugShowLabels,
          ].forEach(cssVarName =>
            el.style.setProperty(cssVarName, 'none')
          );
        }
      },
      update,
     };
  });

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

  React.useEffect(() => {
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

          {/* Arrows, room ids, door ids */}
          {ctxt.visDoorIds.map(doorId => {
            const { poly, normal, roomIds } = ctxt.gm.doors[doorId];
            const sign = roomIds[0] === ctxt.roomId ? 1 : -1;
            const angle = Vect.from(normal).scale(-sign).angle;
            const arrowPos = poly.center.addScaledVector(normal, sign * debugDoorOffset);
            const idIconPos = poly.center.addScaledVector(normal, -sign * debugDoorOffset);
            return [
              <div
                key={doorId}
                data-debug-door-id={doorId}
                data-meta={debugDoorArrowMeta}
                className="debug-door-arrow"
                style={{
                  left: arrowPos.x - debugRadius,
                  top: arrowPos.y - debugRadius,
                  width: debugRadius * 2,
                  height: debugRadius * 2,
                  transform: `rotate(${angle}rad)`,
                  // filter: 'invert(100%)',
                  ...props.canClickArrows === true && { pointerEvents: 'all' },// Prop overrides CSS var
                }}
              />
              ,
              <div
                key={"icon" + doorId}
                className="debug-door-id-icon"
                style={{
                  left: idIconPos.x,
                  top: idIconPos.y - 4,
                  transform: ctxt.undoNonAffineStyle,
                  ...props.showIds === true && { display: 'initial' },
                }}
              >
                {doorId}
              </div>
            ];
          })}

          <div
            className="debug-room-id-icon"
            style={{
              left: ctxt.roomAabb.x + ctxt.roomAabb.width - 8,
              top: ctxt.roomAabb.y + 4,
              ...props.showIds === true && { display: 'initial' },
              transform: ctxt.undoNonAffineStyle,
            }}
          >
            {ctxt.roomId}
          </div>

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
          width={gm.pngRect.width * 2}
          height={gm.pngRect.height * 2}
          style={{
            transformOrigin: 'top left',
            transform: `${gm.transformStyle} scale(0.5) translate(${2 * gm.pngRect.x}px, ${2 * gm.pngRect.y}px)`,
          }}
        />
      )}
    </div>
  );
}

/**
 * @typedef Props
 * @property {boolean} [canClickArrows]
 * @property {boolean} [localNav]
 * @property {boolean} [gmOutlines]
 * @property {boolean} [localOutline]
 * @property {boolean} [showIds]
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
 * @property {DebugRenderTree} tree
 * 
 * @property {React.RefCallback<HTMLDivElement>} rootRef
 * @property {(key: string, navPath: NPC.GlobalNavPath) => void} addNavPath
 * @property {(key: string) => void} removeNavPath
 * @property {() => void} update
 * @property {() => void} changeRoom
 * @property {() => void} render
 */

/**
 * @typedef DebugRenderTree
 * @property {boolean} gmOutlines
 * @property {boolean} roomNav
 * @property {boolean} roomOutline
 * @property {Record<string, DebugRenderPath>} path
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
 * @property {string} undoNonAffineStyle
 */

// 🚧 move to const
const debugRadius = 3;
const debugDoorOffset = 12;

const debugDoorArrowMeta = JSON.stringify({ ui: true, debug: true, 'door-arrow': true });

const rootCss = css`
  canvas {
    position: absolute;
    pointer-events: none;
  }

  // 🚧 old below
  div.debug-room {
    position: absolute;

    div.debug-door-arrow {
      position: absolute;
    }
    div.debug-door-arrow {
      pointer-events: var(${cssName.debugDoorArrowPtrEvts});
      cursor: pointer;
      background-image: url('/assets/icon/circle-right.svg');
      opacity: 0.5;
    }

    div.debug-door-id-icon {
      display: var(${cssName.debugShowIds});
      color: white;
    }
    div.debug-room-id-icon {
      display: var(${cssName.debugShowIds});
      color: #4f4;
    }
    div.debug-door-id-icon, div.debug-room-id-icon {
      position: absolute;
      background: black;
      font-size: 6px;
      line-height: 1;
      border: 1px solid black;
      pointer-events: none;
    }

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
