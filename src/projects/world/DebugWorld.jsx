import React from "react";
import { css, cx } from "@emotion/css";
import { visibleUnicodeLength } from "../service/generic";
import { Vect } from "../geom";
import { ansiColor } from "../sh/util";
import useSessionStore from "../sh/session.store";
import { cssName } from "../service/const";
import useStateRef from "../hooks/use-state-ref";

/**
 * 🚧 merge onClick into state?
 * 🚧 undo inherited transform of labels?
 * 🚧 useMemo to avoid recomputing VDOM?
 */

/** @param {Props} props */
export default function DebugWorld(props) {

  const { fov, gmGraph } = props.api;
  const { gmId, roomId } = fov;
  if (typeof gmId !== 'number') {
    return null;
  }

  const gm = gmGraph.gms[gmId];
  const visDoorIds = props.api.doors.getVisible(gmId);
  const roomNavPoly = gm.lazy.roomNavPoly[roomId];
  const roomNavAabb = roomNavPoly.rect;
  const roomAabb = gm.rooms[roomId].rect;
  const roomPoly = gm.rooms[roomId];
  const roomLabel = gm.point[roomId].labels.find(x => x.tags.includes('room'));

  const state = useStateRef(/** @type {() => State} */ () => {
    return {
      ready: true,
      rootEl: /** @type {HTMLDivElement} */ ({}),
      rootRef(el) {
        if (el) {
          state.rootEl = el;
          [
            cssName.debugDoorArrowPtrEvts,
            cssName.debugGeomorphOutlineDisplay,
            cssName.debugHighlightWindows,
            cssName.debugRoomNavDisplay,
            cssName.debugRoomOutlineDisplay,
            cssName.debugShowIds,
            cssName.debugShowLabels,
          ].forEach(cssVarName => el.style.setProperty(cssVarName, 'none'));
        }
      },
    };
  });

  // 
  /* eslint-disable react-hooks/rules-of-hooks */
  const onClick = React.useCallback(/** @param {React.MouseEvent<HTMLDivElement>} e */ async (e) => {
    const target = (/** @type {HTMLElement} */ (e.target));

    if (target.classList.contains('debug-door-arrow')) {// Manual light control
      const doorId = Number(target.getAttribute('data-debug-door-id'));
      const door = gm.doors[doorId];

      const hullDoorId = gm.getHullDoorId(door);
      if (hullDoorId === -1) {
        fov.setRoom(gmId, gm.getOtherRoomId(door, roomId), doorId);
      }

      const ctxt = gmGraph.getAdjacentRoomCtxt(gmId, hullDoorId);
      if (ctxt) {
        fov.setRoom(ctxt.adjGmId, ctxt.adjRoomId, ctxt.adjDoorId);
      } else {
        console.info('hull door is isolated', gmId, hullDoorId);
      }
    }

    if (target.className === 'debug-label-info') {// Send our first rich message
      const label = gm.labels[Number(target.getAttribute('data-debug-label-id'))];

      const numDoors = gm.roomGraph.getAdjacentDoors(roomId).length;
      const line = `ℹ️  [${ansiColor.Blue}${label.text}${ansiColor.Reset
        }] with ${numDoors} door${numDoors > 1 ? 's' : ''}`;
        
      const sessionCtxts = Object.values(props.api.npcs.session).filter(x => x.receiveMsgs);
      for (const { key: sessionKey } of sessionCtxts) {
        const globalLineNumber = await useSessionStore.api.writeMsgCleanly(sessionKey, line);
        props.api.npcs.addTtyLineCtxts(sessionKey, globalLineNumber, [{
          lineNumber: globalLineNumber,
          lineText: line, 
          linkText: label.text,
          linkStartIndex: visibleUnicodeLength('ℹ️  ['),
          key: 'room', gmId, roomId,
        }]);
      }
    }

  }, [gm, props, gmId, roomId]);

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <div
      className={cx("debug", rootCss)}
      onClick={onClick}
      ref={state.rootRef}
    >

      {gmGraph.gms.map((gm, gmId) =>
        <div
          key={gmId}
          className="geomorph-outline"
          style={{
            left: gm.gridRect.x,
            top: gm.gridRect.y,
            width: gm.gridRect.width,
            height: gm.gridRect.height,
            ...props.geomorphOutlines && { display: 'initial' },// Prop overrides CSS var
          }}
        />  
      )}

      <div
        key={gm.itemKey}
        className="debug-room"
        /** Must transform local ordinates */
        style={{ transform: gm.transformStyle }}
      >

        <svg className="debug-room-nav"
          width={roomNavAabb.width}
          height={roomNavAabb.height}
          style={{
            left: roomNavAabb.x,
            top: roomNavAabb.y,
            ...props.localRoomNav === true && { display: 'initial' },// Prop overrides CSS var
          }}
        >
          <g style={{ transform: `translate(${-roomNavAabb.x}px, ${-roomNavAabb.y}px)` }}>
            <path className="nav-poly" d={roomNavPoly.svgPath} />
            {visDoorIds.map(doorId => {
              const { seg: [src, dst] } = gm.doors[doorId];
              return <line key={doorId} stroke="red" x1={src.x} y1={src.y} x2={dst.x} y2={dst.y} />
            })}
          </g>
        </svg>

        <svg className="debug-room-outline"
          width={roomAabb.width}
          height={roomAabb.height}
          style={{
            left: roomAabb.x,
            top: roomAabb.y,
            ...props.localRoomOutline && { display: 'initial'},
          }}
        >
          <g style={{ transform: `translate(${-roomAabb.x}px, ${-roomAabb.y}px)` }}>
            <path className="room-outline" d={roomPoly.svgPath} />
          </g>
        </svg>

        {
          // Arrows and room/door ids
        }
        {visDoorIds.map(doorId => {
          const { poly, normal, roomIds } = gm.doors[doorId];
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
              style={{ left: idIconPos.x, top: idIconPos.y - 4 }}
            >
              {doorId}
            </div>
          ];
        })}

        <div
          className="debug-room-id-icon"
          style={{
            left: roomNavAabb.x + roomNavAabb.width - 35,
            top: roomNavAabb.y + 25,
            ...props.showIds === true && { display: 'initial' },
          }}
        >
          {roomId}
        </div>

        {
          // More generic approach?
        }
        {roomLabel && (
          <div
            key={roomLabel.index}
            className="debug-label-info"
            data-debug-label-id={roomLabel.index}
            data-tags="debug label-icon"
            title={roomLabel.text}
            style={{
              left: roomLabel.center.x - debugRadius,
              top: roomLabel.center.y - debugRadius,
              width: debugRadius * 2,
              height: debugRadius * 2,
              filter: 'invert(100%)',
              ...props.showLabels && { display: 'initial' },
            }}
          />
        )}

        {gm.windows.map(({ baseRect, angle }, i) => {
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
    </div>
  );
}

/**
 * @typedef Props @type {object}
 * @property {boolean} [canClickArrows]
 * @property {boolean} [localRoomNav]
 * @property {boolean} [geomorphOutlines]
 * @property {boolean} [localRoomOutline]
 * @property {boolean} [showIds]
 * @property {boolean} [showLabels]
 * @property {boolean} [windows]
 * @property {import('../world/World').State} api
 * @property {(debugApi: State) => void} onLoad
 */

/**
 * @typedef State @type {object}
 * @property {boolean} ready
 * @property {HTMLDivElement} rootEl
 * @property {React.RefCallback<HTMLDivElement>} rootRef
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

    div.debug-door-arrow, div.debug-label-info {
      position: absolute;
    }
    div.debug-door-arrow {
      pointer-events: var(${cssName.debugDoorArrowPtrEvts});
      cursor: pointer;
      background-image: url('/assets/icon/circle-right.svg');
    }
    div.debug-label-info {
      display: var(${cssName.debugShowLabels});
      background-image: url('/assets/icon/info-icon.svg');
      cursor: pointer;
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
      font-size: 8px;
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
