import React from "react";
import { css, cx } from "@emotion/css";
import { Subject } from "rxjs";
import { assertNonNull, pause } from "../service/generic";
import { fillPolygon } from "../service/dom";
import { cssName, defaultDoorCloseMs, doorWidth, hullDoorWidth } from "../service/const";
import { geom } from "../service/geom";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @param {Props} props
 */
export default function Doors(props) {

  const update = useUpdate();

  const { gmGraph, gmGraph: { gms }, npcs: { config } } = props.api;

  const state = useStateRef(/** @type {() => State} */ () => ({
    canvas: [],
    events: new Subject,
    open: gms.map((gm, gmId) =>
      gm.doors.map((_, doorId) => props.init?.[gmId]?.includes(doorId) || false)
    ),
    ready: true,
    rootEl: /** @type {HTMLDivElement} */ ({}),
    vis: gms.map(_ => ({})),

    /** @param {number} gmId */
    drawInvisibleInCanvas(gmId) {
      const canvas = state.canvas[gmId];
      const ctxt = assertNonNull(canvas.getContext('2d'));
      const gm = gms[gmId];

      ctxt.setTransform(1, 0, 0, 1, 0, 0);
      ctxt.clearRect(0, 0, canvas.width, canvas.height);
      ctxt.setTransform(1, 0, 0, 1, -gm.pngRect.x, -gm.pngRect.y);
      ctxt.fillStyle = '#555';
      ctxt.strokeStyle = '#000';

      // Handle extension of open visible doors (orig via `relate-connectors` tag)
      const relDoorIds = gm.doors.flatMap((_, i) =>
        state.vis[gmId][i] && state.open[gmId][i] && gm.relDoorId[i]?.doorIds || []
      ).filter(doorId => state.open[gmId][doorId]);
      
      gm.doors.forEach(({ poly }, doorId) => {
        if (!state.vis[gmId][doorId] && !relDoorIds.includes(doorId)) {
          fillPolygon(ctxt, [poly]);
          ctxt.stroke();
        }
      });
    },
    getClosed(gmId) {
      return state.open[gmId].flatMap((open, doorId) => open ? [] : doorId);
    },
    getOpen(gmId) {
      return state.open[gmId].flatMap((open, doorId) => open ? doorId : []);
    },
    getVisible(gmId) {
      return Object.keys(state.vis[gmId]).map(Number);
    },
    async onToggleDoor(gmId, doorId, hullDoorId, triggeredByPlayer) {

      const gmDoorNode = hullDoorId === -1 ? null : gmGraph.getDoorNodeByIds(gmId, hullDoorId);
      const sealed = gmDoorNode?.sealed || gms[gmId].doors[doorId].tags.includes('sealed');

      // NOTE door can be invisible e.g. if closing
      if (sealed) {// Sealed permanently
        return false;
      }

      if (triggeredByPlayer && !config.omnipresent && !state.playerNearDoor(gmId, doorId)) {
        return false;
      }

      if (state.open[gmId][doorId] && !state.safeToCloseDoor(gmId, doorId)) {
        return false;
      }

      if (state.open[gmId][doorId]) {// Animate close slightly early
        const uiEl = state.rootEl.querySelector(`div[data-gm_id="${gmId}"][data-door_id="${doorId}"]`);
        if (uiEl?.parentElement instanceof HTMLElement) {
          uiEl.parentElement.classList.remove('open');
          // await pause(hullDoorId === -1 ? 300/2 : 600/2);
          await pause(100/2);
        }
      }

      // Toggle the door
      state.open[gmId][doorId] = !state.open[gmId][doorId];
      const key = state.open[gmId][doorId] ? 'opened-door' : 'closed-door';
      state.events.next({ key, gmId, doorId });

      // Unsealed hull doors have adjacent door, which must also be toggled
      const adjHull = hullDoorId !== -1 ? gmGraph.getAdjacentRoomCtxt(gmId, hullDoorId) : null;
      if (adjHull) {
        state.open[adjHull.adjGmId][adjHull.adjDoorId] = state.open[gmId][doorId];
        state.events.next({ key, gmId: adjHull.adjGmId, doorId: adjHull.adjDoorId });
      }

      // try to close opened door repeatedly at intervals
      if (key === 'opened-door') {
        const intervalId = window.setInterval(async () => {
          if (!state.open[gmId][doorId] || await state.onToggleDoor(gmId, doorId, hullDoorId, false)) {
            window.clearInterval(intervalId);
          }
        }, defaultDoorCloseMs);
      }

      return true;
    },
    playerNearDoor(gmId, doorId) {
      const { npcs } = props.api;
      const player = npcs.getPlayer();
      if (!player) { // If no player, we are "everywhere"
        return true;
      }
      const center = player.getPosition();
      const radius = npcs.getNpcInteractRadius();
      const door = gms[gmId].doors[doorId];
      const convexPoly = door.poly.clone().applyMatrix(gms[gmId].matrix);
      return geom.circleIntersectsConvexPolygon(center, radius, convexPoly);
    },
    safeToCloseDoor(gmId, doorId) {
      const door = gms[gmId].doors[doorId];
      const convexPoly = door.poly.clone().applyMatrix(gms[gmId].matrix);
      const closeNpcs = props.api.npcs.getNpcsIntersecting(convexPoly);
      return closeNpcs.length === 0;
    },
    setVisible(gmId, doorIds) {
      state.vis[gmId] = doorIds.reduce((agg, id) => ({ ...agg, [id]: true }), {});
      state.drawInvisibleInCanvas(gmId);
      update();
    },
    updateVisibleDoors() {
      const { fov } = props.api;
      const gm = gms[fov.gmId]

      /** Visible doors in current geomorph and possibly hull doors from other geomorphs */
      const nextVis = /** @type {number[][]} */ (gms.map(_ => []));
      nextVis[fov.gmId] = gm.roomGraph.getAdjacentDoors(fov.roomId).map(x => x.doorId);
      gm.roomGraph.getAdjacentHullDoorIds(gm, fov.roomId).flatMap(({ hullDoorId }) =>
        gmGraph.getAdjacentRoomCtxt(fov.gmId, hullDoorId)??[]
      ).forEach(({ adjGmId, adjDoorId }) => (nextVis[adjGmId] = nextVis[adjGmId] || []).push(adjDoorId));

      gms.forEach((_, gmId) => state.setVisible(gmId, nextVis[gmId]));
    },
  }), {
    deps: [props.api, props.api.npcs, gmGraph],
  });

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  React.useEffect(() => {
    gms.forEach((_, gmId) => state.drawInvisibleInCanvas(gmId));
    const onClickDoor = /** @param {PointerEvent} e */ e => {
      const uiEl = /** @type {HTMLElement} */ (e.target);
      if (uiEl.dataset.gm_id === null) return;
      const gmId = Number(uiEl.dataset.gm_id);
      const doorId = Number(uiEl.dataset.door_id);
      const hullDoorId = Number(uiEl.dataset.hull_door_id);
      state.onToggleDoor(gmId, doorId, hullDoorId, true);
    };
    state.rootEl.addEventListener('pointerup', onClickDoor);
    return () => state.rootEl.removeEventListener('pointerup', onClickDoor);
  }, [gms]);
  
  return (
    <div
      ref={el => el && (state.rootEl = el)}
      className={cx(cssName.doors, rootCss)}
    >
      {gms.map((gm, gmId) => (
        <div
          key={gm.itemKey}
          style={{
            transform: gm.transformStyle,
          }}
        >
          {gm.doors.map((door, i) =>
            state.vis[gmId][i] &&
              <div
                key={i}
                className={cx(cssName.door, {
                  [cssName.hull]: door.tags.includes('hull'),
                  [cssName.iris]: door.tags.includes('iris'),
                  [cssName.open]: state.open[gmId][i],
                })}
                style={{
                  left: door.baseRect.x,
                  top: door.baseRect.y,
                  width: door.baseRect.width,
                  height: door.baseRect.height,
                  transform: `rotate(${door.angle}rad)`,
                  transformOrigin: 'top left',
                }}
              >
                <div
                  className={cssName.doorTouchUi}
                  data-gm_id={gmId}
                  data-door_id={i}
                  data-hull_door_id={gm.hullDoors.indexOf(door)}
                />
              </div>
            )
          }
          <canvas
            ref={(el) => el && (state.canvas[gmId] = el)}
            width={gm.pngRect.width}
            height={gm.pngRect.height}
            style={{ left: gm.pngRect.x, top: gm.pngRect.y }}
          />
        </div>
      ))}
    </div>
  );
}

const rootCss = css`
  --npc-door-touch-radius: 10px;

  position: absolute;

  canvas {
    position: absolute;
    pointer-events: none;
  }

  div.door {
    position: absolute;
    pointer-events: none;
    
    .${cssName.doorTouchUi} {
      cursor: pointer;
      pointer-events: all;
      position: absolute;

      width: calc(100% + 2 * var(--npc-door-touch-radius));
      min-width: calc( 2 * var(--npc-door-touch-radius) );
      top: calc(-1 * var(--npc-door-touch-radius) + ${ doorWidth / 2 }px ); /** 5px for hull */
      left: calc(-1 * var(--npc-door-touch-radius));
      height: calc(2 * var(--npc-door-touch-radius));

      background: rgba(100, 0, 0, 0.1);
      border-radius: var(--npc-door-touch-radius);
    }

    &:not(.${cssName.iris}) {
      /* background: #444; */
      background: #fff;
      border: 1px solid #999;

      transition: width 300ms ease-in;
      &.${cssName.open} {
        width: 4px !important;
      }
    }

    &.${cssName.hull} {
      transition: width 600ms ease-in;
      .${cssName.doorTouchUi} {
        top: calc(-1 * var(--npc-door-touch-radius) + ${ hullDoorWidth / 2 }px );
      }
    }

    &.${cssName.iris} {
      background-image: linear-gradient(45deg, #000 33.33%, #888 33.33%, #888 50%, #000 50%, #000 83.33%, #888 83.33%, #aaa 100%);
      background-size: 4.24px 4.24px;
      border: 1px solid #aaa;
      
      opacity: 1;
      transition: opacity 300ms ease;
      &.${cssName.open} {
        opacity: 0.2;
      }
    }
  }
`;

/**
 * @typedef Props @type {object}
 * @property {import('../world/World').State} api
 * @property {{ [gmId: number]: number[] }} [init]
 * @property {(doorsApi: State) => void} onLoad
 */

/**
 * @typedef State @type {object}
 * @property {HTMLCanvasElement[]} canvas
 * @property {(gmId: number) => void} drawInvisibleInCanvas
 * @property {import('rxjs').Subject<DoorMessage>} events
 * @property {(gmId: number) => number[]} getClosed
 * @property {(gmId: number) => number[]} getOpen Get ids of open doors
 * @property {(gmId: number) => number[]} getVisible
 * @property {(gmId: number, doorId: number, hullDoorId: number, triggeredByPlayer: boolean) => Promise<boolean>} onToggleDoor
 * @property {(gmId: number, doorId: number) => boolean} playerNearDoor
 * @property {boolean[][]} open open[gmId][doorId]
 * @property {boolean} ready
 * @property {HTMLDivElement} rootEl
 * @property {(gmId: number, doorId: number) => boolean} safeToCloseDoor
 * @property {(gmId: number, doorIds: number[]) => void} setVisible
 * @property {() => void} updateVisibleDoors
 * @property {{ [doorId: number]: true }[]} vis
 */

/**
 * @typedef DoorMessage @type {object}
 * @property {'opened-door' | 'closed-door'} key
 * @property {number} gmId
 * @property {number} doorId
 */
