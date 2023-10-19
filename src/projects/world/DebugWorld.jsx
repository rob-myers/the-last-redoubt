import React from "react";
import { css, cx } from "@emotion/css";
import { Vect } from "../geom";
import { cssName, hullDoorWidth, wallOutset } from "./const";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import PathIndicator from "./PathIndicator";

/**
 * 🚧 draw to canvas(es) instead
 */

/** @param {Props} props */
export default function DebugWorld(props) {

  const update = useUpdate();

  const state = useStateRef(/** @type {() => State} */ () => {
    return {
      ready: true,
      rootEl: /** @type {HTMLDivElement} */ ({}),
      room: undefined,
      navPath: {},
      ctxts: [],
      show: {
        gmOutlines: false,
      },

      addPath(key, path) {
        state.navPath[key] = {
          key,
          path: path.map(Vect.from),
          meta: { key, path },
        };
        update();
      },
      extendPath(key, extraPoints) {
        const item = state.navPath[key];
        if (item) {
          item.path = item.meta.path = item.path.concat(extraPoints.map(Vect.from));
          update();
        } else {
          state.addPath(key, extraPoints);
        }
      },
      removePath(key) {
        delete this.navPath[key];
        update();
      },
      rootRef(el) {
        if (el) {
          state.rootEl = el;
          // Styles permits getPropertyValue (vs CSS and getComputedStyle)
          !props.api.debug.ready && [
            cssName.debugDoorArrowPtrEvts,
            cssName.debugGeomorphOutlineDisplay,
            cssName.debugHighlightWindows,
            cssName.debugRoomNavDisplay,
            cssName.debugRoomOutlineDisplay,
            cssName.debugShowIds,
            cssName.debugShowLabels,
          ].forEach(cssVarName =>
            el.style.setProperty(cssVarName, 'none')
          );
        }
      },
      update,
      updateRoom() {
        const { gmGraph, fov: { gmId, roomId } } = props.api;
        const gm = gmGraph.gms[gmId];
        const visDoorIds = props.api.doors.getVisibleIds(gmId);
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
      },
      updateShown() {
        const { gmGraph: { gms } } = props.api;
        const { show, ctxts } = state;
        gms.forEach((gm, gmId) => {
          const ctxt = ctxts[gmId];
          ctxt.resetTransform();
          ctxt.clearRect(0, 0, ctxt.canvas.width, ctxt.canvas.height);
          ctxt.transform(2, 0, 0, 2, -2 * gm.pngRect.x, -2 * gm.pngRect.y);
          ctxt.transform(...gm.inverseMatrix.toArray());
          if (show.gmOutlines) {
            ctxt.strokeStyle = 'green';
            ctxt.lineWidth = 4;
            ctxt.strokeRect(gm.gridRect.x, gm.gridRect.y, gm.gridRect.width, gm.gridRect.height);
          }
          // 🚧
        }); 
      },
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
    state.updateShown();
    props.onLoad(state);
  }, []);

  const ctxt = state.room;
  const { gms } = props.api.gmGraph;

  return (
    <div
      className={cx("debug", rootCss)}
      // onClick={onClick}
      ref={state.rootRef}
    >

      <div className="debug-global">

        {Object.values(state.navPath).map(navPath =>
          <PathIndicator key={navPath.key} def={navPath} />  
        )}
      </div>

      {ctxt && (
        <div
          key={ctxt.gm.itemKey}
          className={cx("debug-room", `gm-${ctxt.gmId}`)}
          /** Must transform local ordinates */
          style={{ transform: ctxt.gm.transformStyle }}
        >

          <svg className="debug-room-nav"
            width={ctxt.outsetRoomNavAabb.width}
            height={ctxt.outsetRoomNavAabb.height}
            style={{
              left: ctxt.outsetRoomNavAabb.x,
              top: ctxt.outsetRoomNavAabb.y,
              ...props.localNav === true && { display: 'initial' },// Prop overrides CSS var
            }}
          >
            <g style={{ transform: `translate(${-ctxt.outsetRoomNavAabb.x}px, ${-ctxt.outsetRoomNavAabb.y}px)` }}>
              <path className="nav-poly" d={ctxt.roomNavPoly.svgPath} />
              {ctxt.visDoorIds.map(doorId => {
                const { seg: [src, dst] } = ctxt.gm.doors[doorId];
                return <line key={doorId} stroke="red" x1={src.x} y1={src.y} x2={dst.x} y2={dst.y} />
              })}
            </g>
          </svg>

          <svg className="debug-room-outline"
            width={ctxt.roomAabb.width}
            height={ctxt.roomAabb.height}
            style={{
              left: ctxt.roomAabb.x,
              top: ctxt.roomAabb.y,
              ...props.localOutline && { display: 'initial'},
            }}
          >
            <g style={{ transform: `translate(${-ctxt.roomAabb.x}px, ${-ctxt.roomAabb.y}px)` }}>
              <path className="room-outline" d={ctxt.roomPoly.svgPath} />
            </g>
          </svg>

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
 * @property {DebugRoomCtxt | undefined} room Room-specific data
 * @property {Record<string, NPC.PathIndicatorDef>} navPath
 * @property {CanvasRenderingContext2D[]} ctxts
 * @property {{ gmOutlines: boolean; }} show
 * 
 * @property {React.RefCallback<HTMLDivElement>} rootRef
 * @property {(key: string, points: Geom.VectJson[]) => void} addPath
 * @property {(key: string, extraPoints: Geom.VectJson[]) => void} extendPath
 * @property {(key: string) => void} removePath
 * @property {() => void} update
 * @property {() => void} updateRoom
 * @property {() => void} updateShown
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

  div.debug-global {
    svg {
     position: absolute;
      pointer-events: none;
    }
  }

  div.geomorph-outline {
    display: var(${cssName.debugGeomorphOutlineDisplay});
    position: absolute;
    z-index: 1;
    pointer-events: none;
    border: 2px red solid;
  }

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

    svg.debug-room-nav {
      display: var(${cssName.debugRoomNavDisplay});
    }
    svg.debug-room-outline {
      display: var(${cssName.debugRoomOutlineDisplay});
    }

    svg.debug-room-nav, svg.debug-room-outline {
      position: absolute;
      pointer-events: none;
      path.nav-poly {
        pointer-events: none;
        fill: rgba(255, 0, 0, 0.1);
        stroke: blue;
      }
      path.room-outline {
        pointer-events: none;
        fill: rgba(0, 0, 255, 0.1);
        stroke: red;
      }
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
