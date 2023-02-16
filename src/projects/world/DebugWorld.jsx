import React from "react";
import { css, cx } from "@emotion/css";
import { Vect } from "../geom";
import { cssName, wallOutset } from "../service/const";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * 🚧 merge onClick into state?
 * 🚧 useMemo to avoid recomputing VDOM?
 */

/** @param {Props} props */
export default function DebugWorld(props) {

  const { fov, gmGraph } = props.api;
  const { gmId, roomId } = fov;

  const update = useUpdate();

  const ctxt = React.useMemo(() => {
    if (gmId >= 0) {
      const gm = gmGraph.gms[gmId];
      const visDoorIds = props.api.doors.getVisible(gmId);
      const roomNavPoly = gm.lazy.roomNavPoly[roomId];
      const roomNavAabb = roomNavPoly.rect.outset(wallOutset); // Outset for door lines
      const roomAabb = gm.rooms[roomId].rect;
      const roomPoly = gm.rooms[roomId];
      const roomLabel = gm.point[roomId].labels.find(x => x.tags.includes('room'));
      const undoNonAffineStyle = `matrix(${gm.inverseMatrix.toArray().slice(0, 4)},0, 0)`;
      return {
        gm,
        visDoorIds,
        roomNavPoly,
        roomNavAabb,
        roomAabb,
        roomPoly,
        roomLabel,
        undoNonAffineStyle,
      };
    }
  }, [gmId]);

  const state = useStateRef(/** @type {() => State} */ () => {
    return {
      ready: true,
      rootEl: /** @type {HTMLDivElement} */ ({}),
      rootRef(el) {
        if (el) {
          state.rootEl = el;
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
    };
  });

  /* eslint-disable react-hooks/rules-of-hooks */
  const onClick = React.useCallback(/** @param {React.MouseEvent<HTMLDivElement>} e */ async (e) => {
    const target = (/** @type {HTMLElement} */ (e.target));

    if (ctxt && target.classList.contains('debug-door-arrow')) {// Manual light control
      const doorId = Number(target.getAttribute('data-debug-door-id'));
      const door = ctxt.gm.doors[doorId];

      const hullDoorId = ctxt.gm.getHullDoorId(door);
      if (hullDoorId === -1) {
        fov.setRoom(gmId, ctxt.gm.getOtherRoomId(door, roomId), doorId);
      }

      const roomCtxt = gmGraph.getAdjacentRoomCtxt(gmId, hullDoorId);
      if (roomCtxt) {
        fov.setRoom(roomCtxt.adjGmId, roomCtxt.adjRoomId, roomCtxt.adjDoorId);
      } else {
        console.info('hull door is isolated', gmId, hullDoorId);
      }
    }

  }, [ctxt, props, gmId, roomId]);

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <div
      className={cx("debug", rootCss)}
      onClick={onClick}
      ref={state.rootRef}
    >

      <div className="debug-global">
        {gmGraph.gms.map((gm, gmId) =>
          <div
            key={gmId}
            className="geomorph-outline"
            style={{
              left: gm.gridRect.x,
              top: gm.gridRect.y,
              width: gm.gridRect.width,
              height: gm.gridRect.height,
              ...props.gmOutlines && { display: 'initial' },// Prop overrides CSS var
            }}
          />  
        )}
      </div>

      {ctxt && (
        <div
          key={ctxt.gm.itemKey}
          className="debug-room"
          /** Must transform local ordinates */
          style={{ transform: ctxt.gm.transformStyle }}
        >

          <svg className="debug-room-nav"
            width={ctxt.roomNavAabb.width}
            height={ctxt.roomNavAabb.height}
            style={{
              left: ctxt.roomNavAabb.x,
              top: ctxt.roomNavAabb.y,
              ...props.localNav === true && { display: 'initial' },// Prop overrides CSS var
            }}
          >
            <g style={{ transform: `translate(${-ctxt.roomNavAabb.x}px, ${-ctxt.roomNavAabb.y}px)` }}>
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

          {/* Arrows and room/door ids */}
          {ctxt.visDoorIds.map(doorId => {
            const { poly, normal, roomIds } = ctxt.gm.doors[doorId];
            const sign = roomIds[0] === roomId ? 1 : -1;
            const angle = Vect.from(normal).scale(-sign).angle;
            const arrowPos = poly.center.addScaledVector(normal, sign * debugDoorOffset);
            const idIconPos = poly.center.addScaledVector(normal, -sign * debugDoorOffset);
            return [
              <div
                key={doorId}
                data-debug-door-id={doorId}
                data-tags="debug door-arrow"
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
              left: ctxt.roomNavAabb.x + ctxt.roomNavAabb.width - 35,
              top: ctxt.roomNavAabb.y + 25,
              ...props.showIds === true && { display: 'initial' },
              transform: ctxt.undoNonAffineStyle,
            }}
          >
            {roomId}
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
    </div>
  );
}

/**
 * @typedef Props @type {object}
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
 * @typedef State @type {object}
 * @property {boolean} ready
 * @property {HTMLDivElement} rootEl
 * @property {React.RefCallback<HTMLDivElement>} rootRef
 * @property {() => void} update
 */

const debugRadius = 5;
const debugDoorOffset = 10;

const rootCss = css`

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
