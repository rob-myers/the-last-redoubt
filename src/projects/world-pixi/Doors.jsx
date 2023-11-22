import React from "react";
import { Subject } from "rxjs";
import { RenderTexture, BLEND_MODES } from "@pixi/core";
import { Graphics } from "@pixi/graphics";

import { defaultDoorCloseMs, gmScale } from "../world/const"; // 🚧
import { geom } from "../service/geom";
import useStateRef from "../hooks/use-state-ref";
import GmSprites from "./GmSprites";

/**
 * @param {Props} props
 */
export default function Doors(props) {

  const { api } = props;
  const { gmGraph, gmGraph: { gms }, npcs } = api;
  
  const state = useStateRef(/** @type {() => State} */ () => ({
    events: new Subject,
    gfx: gms.map(_ => new Graphics),
    ready: true,
    tex: gms.map(gm => RenderTexture.create({
      width: gmScale * gm.pngRect.width,
      height: gmScale * gm.pngRect.height,
    })),

    lookup: gms.map((gm, gmId) => gm.doors.map(/** @returns {DoorState} */ (door, doorId) => {
      const isHullDoor = gm.isHullDoor(doorId);
      const hullSealed = isHullDoor ? gmGraph.getDoorNodeById(gmId, doorId)?.sealed : null;
      const sealed = hullSealed || !!door.meta.sealed;
      return {
        door,
        angled: door.normal.x !== 0 && door.normal.y !== 0,
        closeTimeoutId: undefined,
        doorId,
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
    drawDoor(gmId, doorId) {
      const gfx = state.gfx[gmId]
      const item = state.lookup[gmId][doorId];
      gfx.lineStyle({ width: 2, color: 0x666666 });
      gfx.beginFill(0x111111);
      gfx.fill.alpha = gfx.line.alpha = item.open ? 0.2 : 1;
      gfx.drawPolygon(item.door.poly.outline);
      gfx.endFill();
    },
    renderDoor(gmId, doorId) {
      const gfx = state.gfx[gmId].clear();
      gfx.blendMode = BLEND_MODES.DST_ATOP; // Discard extant pixels
      state.drawDoor(gmId, doorId);
      api.renderInto(gfx, state.tex[gmId], false);
      gfx.blendMode = BLEND_MODES.NORMAL;
    },
    getOpenIds(gmId) {
      return state.lookup[gmId].flatMap((item, doorId) => item.open ? doorId : []);
    },
    getVisibleIds(gmId) {
      return state.lookup[gmId].flatMap((x, i) => x.visible ? i : []);
    },
    initTex(gmId) {
      const gm = gms[gmId];
      const lookup = state.lookup[gmId];
      
      // Transform once and for all
      const gfx = state.gfx[gmId].clear().setTransform(-gm.pngRect.x * gmScale, -gm.pngRect.y * gmScale, gmScale, gmScale);
      gfx.lineStyle({ width: 1, color: 0x000000 });

      gfx.blendMode = BLEND_MODES.DST_ATOP;
      gm.doors.forEach((_, doorId) => state.drawDoor(gmId, doorId));
      api.renderInto(gfx, state.tex[gmId]);
      gfx.blendMode = BLEND_MODES.NORMAL;
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
    onRawDoorClick({ meta }) {
      /**
       * We usually handle door clicking via `npc do`.
       * Alternatively we can `click | world doors.onRawDoorClick`.
       */
      const [gmId, doorId] = [Number(meta.gmId), Number(meta.doorId)];
      state.toggleDoor(gmId, doorId, { npcKey: npcs.playerKey ?? undefined });
      // console.log({ gmId, doorId });
    },
    safeToCloseDoor(gmId, doorId) {
      const door = gms[gmId].doors[doorId];
      const convexPoly = door.poly.clone().applyMatrix(gms[gmId].matrix);
      const closeNpcs = props.api.npcs.getNpcsIntersecting(convexPoly);
      return closeNpcs.length === 0;
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

      state.cancelClose(item); // Cancel any pending close
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
        // state.updateVisibleDoors(); // to show doors in adjacent geomorph
      }

      if (key === 'opened-door') {
        state.tryCloseDoor(gmId, doorId);
      }

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
  }), {
    deps: [props.api.npcs],
  });

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  // 🚧 move to use-handle-events
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

  return (
    <GmSprites
      gms={gms}
      tex={state.tex}
    />
  );
}

/**
 * @typedef Props @type {object}
 * @property {import('./WorldPixi').State} api
 * @property {{ [gmId: number]: number[] }} [init]
 * @property {(doorsApi: State) => void} onLoad
 */

/**
 * @typedef State
 * @property {import('rxjs').Subject<DoorMessage>} events
 * @property {DoorState[][]} lookup
 * @property {boolean} ready
 * @property {import('@pixi/graphics').Graphics[]} gfx Reused
 * @property {import('@pixi/core').RenderTexture[]} tex
 * 
 * @property {(item: DoorState) => void} cancelClose
 * @property {(gmId: number, doorId: number) => void} drawDoor
 * @property {(gmId: number, doorId: number) => void} renderDoor
 * @property {(gmId: number) => number[]} getOpenIds Get ids of open doors
 * @property {(gmId: number) => number[]} getVisibleIds
 * @property {(gmId: number) => void} initTex
 * @property {(gmId: number, doorId: number) => boolean} isOpen
 * @property {(e: PanZoom.PointerUpEvent) => void} onRawDoorClick
 * Alternative door open/close handler, enabled via `npc config { scriptDoors: false }`.
 * @property {(gmId: number, doorId: number, npcKey: string) => boolean} npcNearDoor
 * `touchMeta[gmId][doorId]` is stringified meta of respective door
 * @property {(gmId: number, doorId: number) => boolean} safeToCloseDoor
 * @property {(gmId: number, doorId: number, opts?: ToggleDoorOpts) => boolean} toggleDoor
 * Toggle between open/closed state, or directly open/close using `opts`.
 * Returns current boolean value of `open`.
 * @property {(gmId: number, doorId: number, opts?: ToggleLockOpts) => boolean} toggleLock
 * Toggle between unlocked/locked state, or directly lock/unlock using `opts`.
 * Returns current boolean value of `locked`.
 * @property {(gmId: number, doorId: number) => void} tryCloseDoor
 * Try close door every `N` seconds, starting in `N` seconds.
 */

/**
 * This is distinct from `gm.doors.meta`.
 * @typedef DoorState
 * @property {Geomorph.ConnectorRect} door
 * @property {number} [closeTimeoutId]
 * @property {boolean} angled
 * @property {number} doorId
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
