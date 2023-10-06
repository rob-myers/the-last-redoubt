import React from "react";
import { css, cx } from "@emotion/css";
import { Subject } from "rxjs";
import { cssName, defaultDoorCloseMs } from "./const";
import { geom } from "../service/geom";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @param {Props} props
 */
export default function Doors(props) {

  const update = useUpdate();
  const { gmGraph, npcs } = props.api;
  const { gms } = props.api.gmGraph;
  
  const state = useStateRef(/** @type {() => State} */ () => ({
    events: new Subject,
    ready: true,
    rootEl: /** @type {HTMLDivElement} */ ({}),

    lookup: gms.map((gm, gmId) => gm.doors.map(/** @returns {DoorState} */ ({ meta, normal }, doorId) => {
      const isHullDoor = gm.isHullDoor(doorId);
      const hullSealed = isHullDoor ? gmGraph.getDoorNodeById(gmId, doorId)?.sealed : null;
      const sealed = hullSealed || !!meta.sealed;
      return {
        angled: normal.x !== 0 && normal.y !== 0,
        closeTimeoutId: undefined,
        hull: isHullDoor,
        locked: sealed,
        open: props.init?.[gmId]?.includes(doorId) ?? false,
        sealed,
        touchMeta: JSON.stringify({ door: true, ui: true, gmId, doorId }),
        visible: false,
      };
    })),

    cancelClose(doorState) {
      window.clearTimeout(doorState.closeTimeoutId);
      delete doorState.closeTimeoutId;
      
      // 🚧 cancel other hull door too
    },
    getOpenIds(gmId) {
      return state.lookup[gmId].flatMap((item, doorId) => item.open ? doorId : []);
    },
    getVisibleIds(gmId) {
      return state.lookup[gmId].flatMap((x, i) => x.visible ? i : []);
    },
    isOpen(gmId, doorId) {
      return this.lookup[gmId][doorId].open;
    },
    npcNearDoor(gmId, doorId, npcKey) {
      const npc = props.api.npcs.getNpc(npcKey);
      const center = npc.getPosition();
      const radius = npc.getInteractRadius();
      const door = gms[gmId].doors[doorId];
      const convexPoly = door.poly.clone().applyMatrix(gms[gmId].matrix);
      return geom.circleIntersectsConvexPolygon(center, radius, convexPoly);
    },
    onRawDoorClick(e) {
      /**
       * Usually we handle door clicking via `npc do`.
       * It can instead be handled directly via this handler,
       * by setting `npc config { scriptDoors: false }`.
       */
      const { dataset } = /** @type {HTMLElement} */ (e.target);
      if (dataset.meta) {
        const meta = JSON.parse(dataset.meta);
        const gmId = Number(meta.gmId);
        const doorId = Number(meta.doorId);
        state.toggleDoor(gmId, doorId, { npcKey: npcs.playerKey ?? undefined });
        state.updateVisibleDoors();
      }
    },
    safeToCloseDoor(gmId, doorId) {
      const door = gms[gmId].doors[doorId];
      const convexPoly = door.poly.clone().applyMatrix(gms[gmId].matrix);
      const closeNpcs = props.api.npcs.getNpcsIntersecting(convexPoly);
      return closeNpcs.length === 0;
    },
    setVisible(gmId, doorIds) {
      state.lookup[gmId].forEach((x, doorId) => x.visible = doorIds.includes(doorId));
    },
    toggleLock(gmId, doorId, { npcKey, lock, unlock } = {}) {
      const item = state.lookup[gmId][doorId]
      const { sealed, locked: wasLocked } = item;

      if (sealed) {
        return false;
      }
      if (npcKey) {
        const npc = npcs.getNpc(npcKey);
        if (!state.npcNearDoor(gmId, doorId, npcKey) && !(
          npcs.config.omnipresent && npcs.playerKey === npcKey
        )) {
          return wasLocked; // Too far
        }
        if (!npc.has.key[gmId][doorId]) {
          return wasLocked; // No key
        }
      }

      if (wasLocked) {
        if (lock) return true; // Already locked
      } else {
        if (unlock) return false; // Already unlocked
      }
      item.locked = !wasLocked;
      
      // Unsealed hull doors have adjacent door, which must also be toggled
      const adjHull = item.hull ? gmGraph.getAdjacentRoomCtxt(gmId, doorId) : null;
      if (adjHull) {
        state.lookup[adjHull.adjGmId][adjHull.adjDoorId].locked = item.locked;
        // state.events.next({ key, gmId: adjHull.adjGmId, doorId: adjHull.adjDoorId });
        // state.updateVisibleDoors(); // to show doors in adjacent geomorph
      }
      // 🚧 lock event?

      update();

      return item.locked;
    },
    toggleDoor(gmId, doorId, opts = {}) {
      const item = state.lookup[gmId][doorId];
      const { sealed, open: wasOpen } = item;
      const npcKey = opts.npcKey;

      if (sealed) {
        return false;
      }
      if (npcKey && !state.npcNearDoor(gmId, doorId, npcKey) && !(
        npcs.config.omnipresent && npcs.playerKey === npcKey
      )) {
        return wasOpen;
      }

      // Cancel any pending close
      state.cancelClose(item);
      const adjHull = item.hull ? gmGraph.getAdjacentRoomCtxt(gmId, doorId) : null;
      adjHull && state.cancelClose(state.lookup[adjHull.adjGmId][adjHull.adjDoorId]);

      if (wasOpen) {
        if (opts.open) {// Do not open if opened
          state.tryCloseDoor(gmId, doorId); // Reset door close
          return true;
        }
        if (!state.safeToCloseDoor(gmId, doorId)) {
          return true;
        }
      } else {
        if (opts.close) {// Do not close if closed
          return false;
        }
        // Ignore locks if `npcKey` unspecified
        if (item.locked && opts.npcKey && !npcs.npc[opts.npcKey]?.hasDoorKey(gmId, doorId)) {
          return false; // cannot open door if locked
        }
      }

      // Toggle the door
      item.open = !wasOpen;
      const key = wasOpen ? 'closed-door' : 'opened-door';
      state.events.next({ key, gmId, doorId, npcKey });

      // Unsealed hull doors have adjacent door, which must also be toggled
      if (adjHull) {
        state.lookup[adjHull.adjGmId][adjHull.adjDoorId].open = item.open;
        state.events.next({ key, gmId: adjHull.adjGmId, doorId: adjHull.adjDoorId, npcKey });
        state.updateVisibleDoors(); // to show doors in adjacent geomorph
      }

      if (key === 'opened-door') {
        state.tryCloseDoor(gmId, doorId);
      }

      update();

      return item.open;
    },
    tryCloseDoor(gmId, doorId) {
      const item = state.lookup[gmId][doorId];
      item.closeTimeoutId = window.setTimeout(() => {
        if (item.open) {
          state.toggleDoor(gmId, doorId, {}); // returns `false`
          state.tryCloseDoor(gmId, doorId); // recheck in {ms}
        } else {
          delete item.closeTimeoutId;
        }
      }, defaultDoorCloseMs);// 🚧 npc.config.closeTimeoutMs
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
        gm.relDoorId[x.doorId] && state.isOpen(fov.gmId, x.doorId)
          ? [x.doorId, ...gm.relDoorId[x.doorId].doors]
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
        if (state.lookup[adjGmId][adjDoorId].open) {
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

  React.useEffect(() => {// Pause/resume door closing
    if (!npcs.ready) {
      return;
    }
    const handlePause = npcs.events.subscribe(e => {
      if (e.key === 'disabled') {// Cancel future door closings
        state.lookup.forEach(items => items.forEach(item => state.cancelClose(item)));
      } else if (e.key === 'enabled') {// Close open doors
        state.lookup.forEach((items, gmId) => items.forEach((item, doorId) =>
          item.open && state.tryCloseDoor(gmId, doorId) // 🤔 preserve time to close?
        ));
      }
    });
    return () => void handlePause.unsubscribe();
  }, [npcs.ready]);
  
  React.useEffect(() => {// Superseded by `npc do`
    if (npcs.config && (npcs.config.scriptDoors === false)) {
      const callback = state.onRawDoorClick; // maybe mutated on HMR
      state.rootEl.addEventListener('pointerup', callback);
      return () => void state.rootEl.removeEventListener('pointerup', callback);
    }
  }, [npcs.config && npcs.config.scriptDoors]);

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
          {gm.doors.map((door, doorId) => {
            const item = state.lookup[gmId][doorId];
            return item.visible &&
              <div
                key={doorId}
                className={cx(cssName.door, {
                  [cssName.iris]: !!door.meta.iris || !!door.meta.hull,
                  [cssName.hull]: !!door.meta.hull,
                  [cssName.open]: item.open,
                  [cssName.locked]: item.locked,
                })}
                // ℹ️ we see escaping in chrome devtool e.g. &quot;
                data-meta={item.touchMeta}
                style={{
                  left: door.baseRect.x,
                  top: door.baseRect.y,
                  width: door.baseRect.width,
                  height: door.baseRect.height,
                  transform: `rotate(${door.angle}rad)`,
                  transformOrigin: 'top left',
                }}
            />
          })}
        </div>
      ))}
    </div>
  );
}

const rootCss = css`
  ${cssName.npcDoorTouchRadius}: 10px;

  position: absolute;

  div.${cssName.door} {
    position: absolute;
    cursor: pointer;
    background-color: #000;
    border: 1px solid #666;

    &.iris {
      opacity: 1;
      transition: opacity 300ms;
      &.${cssName.open} {
        opacity: 0.1;
      }
    }
    &:not(.iris) {
      /* Non-iris doors slide */
      transition: width 300ms ease-in;
      &.${cssName.open} {
        width: 4px !important;
      }
    }

    /* &.${cssName.hull} {
      border-width: 2px;
    } */
    &.${cssName.locked} {
      background-color: #ff0000;
    }

    /* background-image: linear-gradient(45deg, #000 33.33%, #444 33.33%, #444 50%, #000 50%, #000 83.33%, #444 83.33%, #444 100%);
    background-size: cover; */
    
    &::after {
      content: '';
      cursor: pointer;
      box-sizing: border-box;
      position: absolute;
      border: 1px solid rgba(255, 255, 255, 0.02);
      border-radius: 50%;
      width: calc(100% + var(${cssName.npcDoorTouchRadius}));
      height: calc(2 * var(${cssName.npcDoorTouchRadius}));
      left: 0;
      top: calc(-1 * var(${cssName.npcDoorTouchRadius}) + 50%);
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
 * @property {(item: DoorState) => void} cancelClose
 * @property {import('rxjs').Subject<DoorMessage>} events
 * @property {(gmId: number) => number[]} getOpenIds Get ids of open doors
 * @property {(gmId: number) => number[]} getVisibleIds
 * @property {(gmId: number, doorId: number) => boolean} isOpen
 * @property {(e: PointerEvent) => void} onRawDoorClick
 * Alternative door open/close handler, enabled via `npc config { scriptDoors: false }`.
 * @property {(gmId: number, doorId: number, npcKey: string) => boolean} npcNearDoor
 * @property {boolean} ready
 * @property {HTMLDivElement} rootEl
 * @property {DoorState[][]} lookup
 * `touchMeta[gmId][doorId]` is stringified meta of respective door
 * @property {(gmId: number, doorId: number) => boolean} safeToCloseDoor
 * @property {(gmId: number, doorIds: number[]) => void} setVisible
 * @property {(gmId: number, doorId: number, opts?: ToggleDoorOpts) => boolean} toggleDoor
 * Toggle between open/closed state, or directly open/close using `opts`.
 * Returns current boolean value of `open`.
 * @property {(gmId: number, doorId: number, opts?: ToggleLockOpts) => boolean} toggleLock
 * Toggle between unlocked/locked state, or directly lock/unlock using `opts`.
 * Returns current boolean value of `locked`.
 * @property {(gmId: number, doorId: number) => void} tryCloseDoor
 * Try close door every `N` seconds, starting in `N` seconds.
 * @property {() => void} update
 * @property {() => void} updateVisibleDoors
 */

/**
 * This is distinct from `gm.doors.meta`.
 * @typedef DoorState
 * @property {number} [closeTimeoutId]
 * @property {boolean} angled
 * @property {boolean} hull
 * @property {boolean} locked
 * @property {boolean} open
 * @property {boolean} sealed
 * @property {string} touchMeta
 * @property {boolean} visible
 */

/**
 * @typedef DoorMessage
 * @property {'opened-door' | 'closed-door'} key
 * @property {number} gmId
 * @property {number} doorId
 * @property {string} [npcKey]
 */

/**
 * @typedef ToggleDoorOpts
 * @property {boolean} [close] should we close the door?
 * @property {string} [npcKey] initiated via npc?
 * @property {boolean} [open] should we open the door?
 */

/**
 * @typedef ToggleLockOpts
 * @property {boolean} [lock] should we lock the door?
 * @property {string} [npcKey] initiated via npc? (if so, check keys)
 * @property {boolean} [unlock] should we unlock the door?
 */
