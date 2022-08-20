import React from "react";
import { filter, first, map, take } from "rxjs/operators";

import { removeCached, setCached } from "../service/query-client";
import { otag } from "../service/rxjs";
import { Vect } from "../geom";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import useGeomorphs from "../geomorph/use-geomorphs";
import CssPanZoom from "../panzoom/CssPanZoom";
import NPCs, { State as NpcsApi } from "./NPCs";
import Doors, { State as DoorsApi } from "./Doors";
import Geomorphs from "./Floor";
import FOV, { State as FovApi } from "./FOV";
import DebugWorld from "./DebugWorld";
import useHandleEvents from "./use-handle-events";

/** @param {Props} props */
export default function World(props) {

  const update = useUpdate();

  const state = useStateRef(/** @type {() => State} */ () => ({
    everEnabled: false,
    gmGraph: /** @type {Graph.GmGraph} */ ({}),

    doors: /** @type {DoorsApi} */  ({ ready: false }),
    fov: /** @type {FovApi} */  ({ ready: false }),
    npcs: /** @type {NpcsApi} */  ({ ready: false }),
    panZoom: /** @type {PanZoom.CssApi} */ ({ ready: false }),

    lib: {
      Vect,
      filter, first, map, take, otag,
    },

    isReady() {
      return [state.doors, state.fov, state.npcs, state.panZoom].every(x => x.ready);
    },

    updateAll() {
      state.fov.updateClipPath();
      state.doors.updateVisibleDoors();
      update();
    },

  }));

  // graphGraph.gms.length can be truthy without ever enabling,
  // by viewing another World with same `props.gms`
  const gmGraph = useGeomorphs(
    props.gms, 
    !(state.everEnabled ||= !props.disabled),
  );
  state.gmGraph = gmGraph;

  useHandleEvents(state, gmGraph);

  React.useEffect(() => {
    setCached(props.worldKey, state);
    return () => removeCached(props.worldKey);
  }, []);

  return state.everEnabled && gmGraph.gms.length ? (
    <CssPanZoom
      initZoom={1.5}
      initCenter={{ x: 300, y: 300 }}
      background="#000"
      // grid
      onLoad={api => (state.panZoom = api) && update()}
    >
      <Geomorphs
        gms={gmGraph.gms}
      />

      <DebugWorld
        // canClickArrows
        // localNav
        // outlines
        // roomOutlines
        showIds
        showLabels
        // windows
        api={state}
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
 * @property {boolean} everEnabled
 * @property {Graph.GmGraph} gmGraph
 * @property {DoorsApi} doors
 * @property {FovApi} fov
 * @property {NpcsApi} npcs
 * @property {PanZoom.CssApi} panZoom
 * @property {() => boolean} isReady
 * @property {() => void} updateAll
 * @property {StateUtil} lib
 */

/**
 * @typedef StateUtil Utility classes and `rxjs` functions
 * @property {typeof import('../geom').Vect} Vect
 * @property {import('../service/rxjs').filter} filter
 * @property {import('../service/rxjs').first} first
 * @property {import('../service/rxjs').map} map
 * @property {import('../service/rxjs').otag} otag
 * @property {import('../service/rxjs').take} take
 */
