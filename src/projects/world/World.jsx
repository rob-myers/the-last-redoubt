import React from "react";
import { css } from "@emotion/css";
import { filter, first, map, take } from "rxjs/operators";
import { merge } from "rxjs";

import { precision, removeFirst } from "../service/generic";
import { removeCached, setCached } from "../service/query-client";
import { Vect } from "../geom";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import useGeomorphs from "../geomorph/use-geomorphs";
import CssPanZoom from "../panzoom/CssPanZoom";
import Decor from "./Decor";
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
    gmGraph: /** @type {State['gmGraph']} */ ({}),
    gmRoomGraph: /** @type {State['gmRoomGraph']} */ ({}),

    debug: /** @type {State['debug']} */ ({ ready: false }),
    decor: /** @type {State['decor']} */ ({ ready: false }),
    doors: /** @type {State['doors']} */  ({ ready: false }),
    fov: /** @type {State['fov']} */  ({ ready: false }),
    geomorphs: /** @type {State['geomorphs']} */  ({ ready: false }),
    npcs: /** @type {State['npcs']} */  ({ ready: false }),
    panZoom: /** @type {PanZoom.CssApi} */ ({ ready: false }),

    getRootEl() {
      return state.panZoom.parent;
    },
    isReady() {
      return [
        state.debug, 
        state.decor, 
        state.doors, 
        state.fov, 
        state.geomorphs, 
        state.npcs, 
        state.panZoom,
      ].every(x => x.ready);
    },
    lib: {
      Vect,
      filter, first, map, merge, take,
      precision,
      removeFirst,
    },
    rootCss: `hide-gms ${css`${props.gms.map((_, gmId) =>
      `&.hide-gms:not(.show-gm-${gmId}) .gm-${gmId} { display: none; };`,
    ).join('\n')}`}`,
    update,
  }));

  ({ gmGraph: state.gmGraph, gmRoomGraph: state.gmRoomGraph } = useGeomorphs(props.gms, props.disabled));
  state.gmGraph.api = state;
  
  useHandleEvents(state);
  
  React.useEffect(() => {
    setCached(props.worldKey, state);
    return () => removeCached(props.worldKey);
  }, []);

  React.useEffect(() => {
    state.disabled = !!props.disabled;
    state.npcs.events?.next({ key: state.disabled ? 'disabled' : 'enabled' });
  }, [props.disabled]);

  return state.gmGraph.ready ? (
    <CssPanZoom
      className={state.rootCss}
      init={props.init}
      background="#000"
      onLoad={api => (state.panZoom = api) && update()}
      // grid // ℹ️ slow zooming
    >
      <Geomorphs
        api={state}
        onLoad={api => (state.geomorphs = api) && update()}
      />

      <DebugWorld
        // 👋 can use e.g. `npc config showIds` instead of prop showIds
        api={state}
        onLoad={api => (state.debug = api) && update()}
      />

      <Decor
        api={state}
        onLoad={api => (state.decor = api) && update()}
      />

      <NPCs
        api={state}
        onLoad={api => (state.npcs = api) && update()}
      />

      <Doors
        api={state}
        onLoad={api => (state.doors = api) && update()}
      />

      <FOV
        api={state}
        onLoad={api => (state.fov = api) && update()}
      />
    </CssPanZoom>
  ) : null;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {Geomorph.UseGeomorphsDefItem[]} gms
 * @property {import('../panzoom/CssPanZoom').Props['init']} [init]
 * @property {string} worldKey
 */

/**
 * @typedef State
 * @property {boolean} disabled
 * @property {Graph.GmGraph} gmGraph
 * @property {Graph.GmRoomGraph} gmRoomGraph
 * @property {import("./DebugWorld").State} debug
 * @property {import("./Decor").State} decor
 * @property {import("./Doors").State} doors
 * @property {import("./FOV").State} fov
 * @property {import("./Geomorphs").State} geomorphs
 * @property {() => HTMLDivElement} getRootEl
 * @property {() => boolean} isReady
 * @property {StateUtil} lib
 * @property {import("./NPCs").State} npcs
 * @property {PanZoom.CssApi} panZoom
 * @property {string} rootCss
 * @property {() => void} update
 */

/**
 * @typedef StateUtil Utility classes and `rxjs` functions
 * @property {typeof import('../geom').Vect} Vect
 * @property {typeof filter} filter
 * @property {typeof first} first
 * @property {typeof map} map
 * @property {typeof merge} merge
 * @property {typeof precision} precision
 * @property {typeof removeFirst} removeFirst
 * @property {typeof take} take
 */
