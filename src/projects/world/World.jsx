import React from "react";
import { filter, first, map, take } from "rxjs/operators";

import { removeCached, setCached } from "../service/query-client";
import { Vect } from "../geom";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import useGeomorphs from "../geomorph/use-geomorphs";
import CssPanZoom from "../panzoom/CssPanZoom";
import NPCs from "./NPCs";
import Doors from "./Doors";
import Geomorphs from "./Geomorphs";
import FOV from "./FOV";
import DebugWorld from "./DebugWorld";
import useHandleEvents from "./use-handle-events";

/** @param {Props} props */
export default function World(props) {

  const update = useUpdate();

  const state = useStateRef(/** @type {() => State} */ () => ({
    disabled: !!props.disabled,
    everEnabled: false,
    gmGraph: /** @type {Graph.GmGraph} */ ({}),

    debug: /** @type {State['debug']} */ ({ ready: false }),
    doors: /** @type {State['doors']} */  ({ ready: false }),
    fov: /** @type {State['fov']} */  ({ ready: false }),
    npcs: /** @type {State['npcs']} */  ({ ready: false }),
    panZoom: /** @type {PanZoom.CssApi} */ ({ ready: false }),

    lib: {
      Vect,
      filter, first, map, take,
    },

    isReady() {
      return [state.doors, state.fov, state.npcs, state.panZoom].every(x => x.ready);
    },

    updateAll() {
      try {
        state.fov.updateClipPath();
        state.doors.updateVisibleDoors();
      } catch (e) {
        console.error('updateAll failed', e);
      }
      update();
    },
  }));

  // ℹ️ `state.gmGraph.ready` can be true without ever enabling,
  // i.e. by viewing another World with same `props.gms`
  state.gmGraph = useGeomorphs(
    props.gms,
    !(state.everEnabled ||= !props.disabled),
  );
  state.gmGraph.api = state;

  useHandleEvents(state);

  React.useEffect(() => {
    state.disabled = !!props.disabled;
    state.npcs.events?.next({ key: props.disabled ? 'disabled' : 'enabled' });
  }, [props.disabled, state.npcs.ready]);

  React.useEffect(() => {
    setCached(props.worldKey, state);
    return () => removeCached(props.worldKey);
  }, []);

  return state.everEnabled && state.gmGraph.ready ? (
    <CssPanZoom
      initZoom={1.5}
      initCenter={{ x: 300, y: 300 }}
      background="#000"
      grid
      onLoad={api => (state.panZoom = api) && update()}
    >
      <Geomorphs
        api={state}
      />

      <DebugWorld
        // 👋 e.g. use `npc config showIds` instead of prop showIds
        api={state}
        onLoad={api => (state.debug = api) && update()}
      />

      <NPCs
        api={state}
        disabled={props.disabled}
        onLoad={api => (state.npcs = api) && update()}
      />

      <FOV
        api={state}
        onLoad={api => (state.fov = api) && update()}
      />

      <Doors
        api={state}
        init={props.init.open}
        onLoad={api => (state.doors = api) && update()}
      />

    </CssPanZoom>
  ) : null;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {Geomorph.UseGeomorphsDefItem[]} gms
 * @property {{ open?: {[gmId: number]: number[]} }} init
 * @property {string} worldKey
 */

/**
 * @typedef State
 * @property {boolean} disabled
 * @property {boolean} everEnabled
 * @property {Graph.GmGraph} gmGraph
 * @property {import("./DebugWorld").State} debug
 * @property {import("./Doors").State} doors
 * @property {import("./FOV").State} fov
 * @property {import("./NPCs").State} npcs
 * @property {PanZoom.CssApi} panZoom
 * @property {() => boolean} isReady
 * @property {() => void} updateAll
 * @property {StateUtil} lib
 */

/**
 * @typedef StateUtil Utility classes and `rxjs` functions
 * @property {typeof import('../geom').Vect} Vect
 * @property {typeof filter} filter
 * @property {typeof first} first
 * @property {typeof map} map
 * @property {typeof take} take
 */
