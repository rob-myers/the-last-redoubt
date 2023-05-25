import React from "react";
import { css, cx } from "@emotion/css";
import { Subject } from "rxjs";
import { assertNonNull, pause } from "../service/generic";
import { cssName, defaultDoorCloseMs, doorWidth, hullDoorWidth } from "./const";
import { geom } from "../service/geom";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @param {Props} props
 */
export default function Doors(props) {

  const update = useUpdate();
  const { gmGraph, gmGraph: { gms }, npcs } = props.api;
  
  const state = useStateRef(/** @type {() => State} */ () => ({
    // know gmGraph is ready (condition for Doors to be mounted)
    closing: gms.map((gm, _) => gm.doors.map(__ => null)),
    events: new Subject,
    open: gms.map((gm, gmId) =>
      gm.doors.map((_, doorId) => props.init?.[gmId]?.includes(doorId) || false)
    ),
    ready: true,
    rootEl: /** @type {HTMLDivElement} */ ({}),
    vis: gms.map(_ => ({})),

    getOpenIds(gmId) {
      return state.open[gmId].flatMap((open, doorId) => open ? doorId : []);
    },
    getVisibleIds(gmId) {
      return Object.keys(state.vis[gmId]).map(Number);
    },
    npcNearDoor(gmId, doorId, npcKey) {
      const npc = props.api.npcs.getNpc(npcKey);
      const center = npc.getPosition();
      const radius = npc.getInteractRadius();
      const door = gms[gmId].doors[doorId];
      const convexPoly = door.poly.clone().applyMatrix(gms[gmId].matrix);
      return geom.circleIntersectsConvexPolygon(center, radius, convexPoly);
    },
    onClickDoor(e) {
      const uiEl = /** @type {HTMLElement} */ (e.target);
      if (uiEl.dataset.gm_id !== null) {
        const gmId = Number(uiEl.dataset.gm_id);
        const doorId = Number(uiEl.dataset.door_id);
        state.toggleDoor(gmId, doorId, { viaClick: true });
      }
    },
    safeToCloseDoor(gmId, doorId) {
      const door = gms[gmId].doors[doorId];
      const convexPoly = door.poly.clone().applyMatrix(gms[gmId].matrix);
      const closeNpcs = props.api.npcs.getNpcsIntersecting(convexPoly);
      return closeNpcs.length === 0;
    },
    setVisible(gmId, doorIds) {
      state.vis[gmId] = doorIds.reduce((agg, id) => ({ ...agg, [id]: true }), {});
    },
    async toggleDoor(gmId, doorId, opts = {}) {
      const hullDoorId = gms[gmId].getHullDoorId(doorId);
      const gmDoorNode = hullDoorId === -1 ? null : gmGraph.getDoorNodeById(gmId, hullDoorId);
      const sealed = gmDoorNode?.sealed || gms[gmId].doors[doorId].meta.sealed;
      const wasOpen = state.open[gmId][doorId];
      const npcKey = opts.npcKey ?? (opts.viaClick && !npcs.config.omnipresent ? npcs.playerKey : null);

      if (sealed) {
        return false;
      }
      if (opts.close && (!wasOpen || state.closing[gmId][doorId])) {
        return false; // Do not close if closed or closing
      }
      if (opts.open && (wasOpen && !state.closing[gmId][doorId])) {
        return false; // Do not open if opened and not closing
      }
      if (npcKey && !state.npcNearDoor(gmId, doorId, npcKey)) {
        return false;
      }
      if (wasOpen && !state.safeToCloseDoor(gmId, doorId)) {
        return false;
      }

      if (wasOpen) {
        // Cancel any pending close
        window.clearTimeout(state.closing[gmId][doorId]?.timeoutId);
        // Animate close slightly early
        const uiEl = state.rootEl.querySelector(`div[data-gm_id="${gmId}"][data-door_id="${doorId}"]`);
        if (uiEl?.parentElement instanceof HTMLElement) {
          uiEl.parentElement.classList.remove('open');
          await pause(100/2);
        }
      }

      // Toggle the door
      state.open[gmId][doorId] = !wasOpen;
      const key = wasOpen ? 'closed-door' : 'opened-door';
      state.events.next({ key, gmId, doorId });

      // Unsealed hull doors have adjacent door, which must also be toggled
      const adjHull = hullDoorId !== -1 ? gmGraph.getAdjacentRoomCtxt(gmId, hullDoorId) : null;
      if (adjHull) {
        state.open[adjHull.adjGmId][adjHull.adjDoorId] = state.open[gmId][doorId];
        state.events.next({ key, gmId: adjHull.adjGmId, doorId: adjHull.adjDoorId });
        state.updateVisibleDoors(); // to show doors in adjacent geomorph
      }

      if (key === 'opened-door') {
        state.tryCloseDoor(gmId, doorId);
      }

      update();

      return true;
    },
    tryCloseDoor(gmId, doorId) {
      const timeoutId = window.setTimeout(async () => {
        if (state.open[gmId][doorId] && !await state.toggleDoor(gmId, doorId, {})) {
          state.tryCloseDoor(gmId, doorId); // try again
        } else {
          state.closing[gmId][doorId] = null;
        }
      }, defaultDoorCloseMs);// 🚧 change ms?
      state.closing[gmId][doorId] = { timeoutId };
    },
    update,
    updateVisibleDoors() {
      /**
       * Visible doors in current geomorph including related doors.
       * - includes all doors in current/adj rooms
       * - extended by relDoorId (relate-connector)
       * - possibly includes hull doors from other geomorphs
       * - over-approx but only computed on change current room
       */
      const nextVis = /** @type {number[][]} */ (gms.map(_ => []));

      const { fov } = props.api;
      const gm = gms[fov.gmId];

      const adjRoomIds = gm.roomGraph.getAdjRoomIds(fov.roomId);
      /** All doors in curr/adj rooms, extended 1-step by relDoorId */
      const extAdjDoors = gm.roomGraph.getAdjacentDoors(
        ...adjRoomIds.concat(fov.roomId)
      ).flatMap(x =>
        gm.relDoorId[x.doorId] && state.open[fov.gmId][x.doorId]
          ? [x.doorId, ...gm.relDoorId[x.doorId].doorIds]
          : x.doorId
      );
      nextVis[fov.gmId] = extAdjDoors;

      /**
       * - Include hull doors from neighbouring geomorphs
       * - If hull door open, include doors from room in adjacent geomorph
       */
      const nextVisSet = /** @type {Set<number>[]} */ ([]);
      gm.roomGraph.getAdjacentHullDoorIds(gm, fov.roomId).flatMap(({ hullDoorId }) =>
        gmGraph.getAdjacentRoomCtxt(fov.gmId, hullDoorId)??[]
      ).forEach(({ adjGmId, adjDoorId, adjRoomId }) => {
        (nextVisSet[adjGmId] ||= new Set).add(adjDoorId);
        if (state.open[adjGmId][adjDoorId]) {
          // Include adj doors, possibly seen thru hull door
          gms[adjGmId].roomGraph.getAdjacentDoors(adjRoomId).forEach(
            x => nextVisSet[adjGmId].add(x.doorId)
          );
        }
      });
      nextVisSet.forEach((set, altGmId) => (nextVis[altGmId] ||= []).push(...set.values()));

      gms.forEach((_, gmId) => state.setVisible(gmId, nextVis[gmId]));
      update();
    },
  }), {
    deps: [props.api.npcs],
  });

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  React.useEffect(() => {// Initial setup
    if (npcs.ready) {
      const handlePause = npcs.events.subscribe(e => {
        e.key === 'disabled' && // Cancel future door closings
          state.closing.forEach(doors => doors.forEach(meta => window.clearTimeout(meta?.timeoutId)));
        e.key === 'enabled' && // Schedule pending door closures
          state.closing.forEach((doors, gmId) => doors.forEach((meta, doorId) => {
            meta && (meta.timeoutId = window.setTimeout(() => state.tryCloseDoor(gmId, doorId)))
          }));
      });

      const callback = state.onClickDoor; // ℹ️ state.onClickDoor can be mutated on HMR
      state.rootEl.addEventListener('pointerup', callback);
      return () => {
        handlePause.unsubscribe();
        state.rootEl.removeEventListener('pointerup', callback);
      };
    }
  }, [npcs.ready]);
  
  return (
    <div
      ref={el => el && (state.rootEl = el)}
      className={cx(cssName.doors, rootCss)}
    >
      {gms.map((gm, gmId) => (
        <div
          key={gm.itemKey}
          className={`gm-${gmId}`}
          style={{ transform: gm.transformStyle }}
        >
          {gm.doors.map((door, i) =>
            state.vis[gmId][i] &&
              <div
                key={i}
                className={cx(cssName.door, {
                  [cssName.hull]: door.meta.hull === true,
                  [cssName.iris]: door.meta.iris === true,
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
                  data-meta={doorTouchUiMeta}
                />
                <div
                  className="other-door"
                  style={{
                    transform: `translate(${door.baseRect.width}px, -1px) scale(-1, 1)`,
                  }}
                />
              </div>
            )
          }
        </div>
      ))}
    </div>
  );
}

const doorTouchUiMeta = JSON.stringify({ ui: true });

const rootCss = css`
  ${cssName.npcDoorTouchRadius}: 10px;

  position: absolute;

  canvas {
    position: absolute;
    pointer-events: none;
  }

  div.door {
    position: absolute;
    pointer-events: none;
    
    &:not(.${cssName.iris}) {
      /* background: #444; */
      background: #fff;
      border: 1px solid #000000;
      
      transition: width 300ms ease-in;
      &.${cssName.open} {
        width: 4px !important;
      }
      .other-door {
        position: absolute;
        width: inherit;
        height: inherit;
        border: 1px solid #000000;
        background: #fff;
        transform-origin: top left;
        transform: scale(-1, 1);
      }
    }

    &.${cssName.hull} {
      transition: width 300ms ease-in;
      .${cssName.doorTouchUi} {
        top: calc(-1 * var(${cssName.npcDoorTouchRadius}) + ${ hullDoorWidth / 2 }px );
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

    .${cssName.doorTouchUi} {
      cursor: pointer;
      pointer-events: all;
      position: absolute;

      width: calc(100% + 2 * var(${cssName.npcDoorTouchRadius}));
      min-width: calc( 2 * var(${cssName.npcDoorTouchRadius}) );
      top: calc(-1 * var(${cssName.npcDoorTouchRadius}) + ${ doorWidth / 2 }px ); /** 5px for hull */
      left: calc(-1 * var(${cssName.npcDoorTouchRadius}));
      height: calc(2 * var(${cssName.npcDoorTouchRadius}));

      background: rgba(100, 0, 0, 0.1);
      border-radius: var(${cssName.npcDoorTouchRadius});
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
 * @property {(null | { timeoutId: number; })[][]} closing Provides `closing[gmId][doorId]?.timeoutId`
 * @property {import('rxjs').Subject<DoorMessage>} events
 * @property {(gmId: number) => number[]} getOpenIds Get ids of open doors
 * @property {(gmId: number) => number[]} getVisibleIds
 * @property {(e: PointerEvent) => void} onClickDoor
 * @property {(gmId: number, doorId: number, npcKey: string) => boolean} npcNearDoor
 * @property {boolean[][]} open `open[gmId][doorId]`
 * @property {boolean} ready
 * @property {HTMLDivElement} rootEl
 * @property {(gmId: number, doorId: number) => boolean} safeToCloseDoor
 * @property {(gmId: number, doorIds: number[]) => void} setVisible
 * @property {(gmId: number, doorId: number, opts?: ToggleDoorOpts) => Promise<boolean>} toggleDoor
 * @property {(gmId: number, doorId: number) => void} tryCloseDoor
 * Try close door every `N` seconds, starting in `N` seconds.
 * @property {() => void} update
 * @property {() => void} updateVisibleDoors
 * @property {{ [doorId: number]: true }[]} vis
 */

/**
 * @typedef DoorMessage
 * @property {'opened-door' | 'closed-door'} key
 * @property {number} gmId
 * @property {number} doorId
 */

/**
 * @typedef ToggleDoorOpts
 * @property {boolean} [close] should we close the door?
 * @property {string} [npcKey] initiated via npc?
 * @property {boolean} [open] should we open the door?
 * @property {boolean} [viaClick] initiated via click?
 */
