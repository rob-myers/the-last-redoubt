import React from "react";
import { css } from "@emotion/css";
import { filter, first, map, take } from "rxjs/operators";
import { merge } from "rxjs";

import { precision } from "../service/generic";
import { removeCached, setCached } from "../service/query-client";
import { observableToAsyncIterable } from "../service/observable-to-async-iterable";
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
    opts: { x: 600, y: 300, zoom: 1.5, ...props.opts },
    disabled: !!props.disabled,
    everEnabled: false,
    everReady: false,
    gmGraph: /** @type {Graph.GmGraph} */ ({}),

    debug: /** @type {State['debug']} */ ({ ready: false }),
    decor: /** @type {State['decor']} */ ({ ready: false }),
    doors: /** @type {State['doors']} */  ({ ready: false }),
    fov: /** @type {State['fov']} */  ({ ready: false }),
    geomorphs: /** @type {State['geomorphs']} */  ({ ready: false }),
    npcs: /** @type {State['npcs']} */  ({ ready: false }),
    panZoom: /** @type {PanZoom.CssApi} */ ({ ready: false }),

    rootCss: css`${
      props.gms.map((_, gmId) =>
        `&:not(.show-gm-${gmId}) .gm-${gmId} { display: none; }; `,
      ).join('\n')
    }`,
    lib: {
      Vect,
      filter, first, map, merge, take,
      observableToAsyncIterable,
      precision,
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
    update,
  }));

  // ℹ️ `state.gmGraph.ready` can be true without ever enabling,
  // by viewing another World with same `props.gms`
  state.gmGraph = useGeomorphs(props.gms, !(state.everEnabled ||= !props.disabled));
  state.gmGraph.api = state;
  
  useHandleEvents(state);
  
  React.useEffect(() => {
    setCached(props.worldKey, state);
    return () => removeCached(props.worldKey);
  }, []);

  const ready = state.isReady();
  React.useEffect(() => {
    if (!state.everReady && (state.everReady ||= ready)) {
      state.npcs.events.next({ key: 'world-ready' }); // Propagate ready
    }
    state.disabled = !!props.disabled;
    if (ready) {// Once ready, propagate enabled/disabled
      state.npcs.events.next({ key: state.disabled ? 'disabled' : 'enabled' });
    }
  }, [props.disabled, ready]);

  return state.everEnabled && state.gmGraph.ready ? (
    <CssPanZoom
      className={state.rootCss}
      initZoom={state.opts.zoom}
      initCenter={state.opts}
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
 * @property {Partial<State['opts']>} [opts]
 * @property {string} worldKey
 */

/**
 * @typedef State
 * @property {{ x: number; y: number; zoom: number; }} opts
 * @property {boolean} disabled
 * @property {boolean} everEnabled
 * @property {boolean} everReady
 * @property {Graph.GmGraph} gmGraph
 * @property {import("./DebugWorld").State} debug
 * @property {import("./Decor").State} decor
 * @property {import("./Doors").State} doors
 * @property {import("./FOV").State} fov
 * @property {import("./Geomorphs").State} geomorphs
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
 * @property {typeof take} take
 * @property {typeof observableToAsyncIterable} observableToAsyncIterable
 */
