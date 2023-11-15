import React from "react";
import { Stage } from "@pixi/react";
import { QueryClientProvider } from "react-query";
import useMeasure from "react-use-measure";
import { filter, first, map, take } from "rxjs/operators";
import { merge } from "rxjs";

import { precision, removeFirst } from "../service/generic";
import { queryClient, removeCached, setCached } from "../service/query-client";
import { npcService } from "../service/npc";
import { Vect } from "../geom";

import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useGeomorphs from "../geomorph/use-geomorphs";
import useHandleEvents from "./use-handle-events";
import PanZoom from "./PanZoom";
import Geomorphs from "./Geomorphs";
import Doors from "./Doors";
import NPCs from "./NPCs";
import DebugWorld from "./DebugWorld";
import Decor from "./Decor";
import FOV from "./FOV";
import { Origin, TestRenderTexture, TestSprite } from "./Misc";

/**
 * @param {Props} props
 */
export default function WorldPixi(props) {

  const state = useStateRef(/** @type {() => State} */ () => ({
    disabled: !!props.disabled,
    gmGraph: /** @type {*} */ ({}),
    gmRoomGraph: /** @type {*} */ ({}),
    pixiApp: /** @type {*} */ ({}),
    renderer: /** @type {*} */ ({}),

    decor: /** @type {State['decor']} */  ({ ready: false }),
    debug: /** @type {State['debug']} */  ({ ready: false }),
    doors: /** @type {State['doors']} */  ({ ready: false }),
    fov: /** @type {State['fov']} */  ({ ready: false }),
    geomorphs: /** @type {State['geomorphs']} */  ({ ready: false }),
    npcs: /** @type {State['npcs']} */  ({ ready: false }),
    panZoom: /** @type {State['panZoom']} */  ({ ready: false }),
    lib: {
      filter, first, map, merge, take,
      isVectJson: Vect.isVectJson,
      vectFrom: Vect.from,
      precision, removeFirst,
      ...npcService,
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
    renderInto(displayObj, tex, clear = true) {
      state.renderer.render(displayObj, { renderTexture: tex, clear });
    },
  }));

  const update = useUpdate();
  const [rootRef, bounds] = useMeasure({ debounce: 30, scroll: false });
  useHandleEvents(state);

  ({
    gmGraph: state.gmGraph,
    gmRoomGraph: state.gmRoomGraph
  } = useGeomorphs(props.gms, props.disabled));
  state.gmGraph.api = state.gmRoomGraph.api = state;

  React.useEffect(() => {
    setCached(props.worldKey, state);
    return () => removeCached(props.worldKey);
  }, []);

  return (
    <div
      ref={rootRef}
      style={{ width: '100%', height: '100%' }}
    >
      {state.gmGraph.ready && (
        <Stage
          options={{
            hello: true,
            antialias: true,
            resolution: window.devicePixelRatio,
            powerPreference: 'low-power',
            backgroundColor: 0x111111,
            eventFeatures: {
              globalMove: false,
              move: true,
              click: true,
              wheel: true,
            },
            // resolution: 4, // ℹ️ no zoom flicker, but can set on filter
          }}
          onMount={app => {
            state.pixiApp = app;
            state.renderer = /** @type {import('pixi.js').Renderer} */ (app.renderer);
          }}
          width={bounds.width || undefined}
          height={bounds.height || undefined}
        >
          <QueryClientProvider client={queryClient} >
            <PanZoom
              api={state}
              onLoad={api => (state.panZoom = api) && update()}
            >
              <Geomorphs
                api={state}
                onLoad={api => (state.geomorphs = api) && update()}
              />

              <Doors
                api={state}
                onLoad={api => (state.doors = api) && update()}
              />

              <Decor
                api={state}
                onLoad={api => (state.decor = api) && update()}
              />

              <NPCs
                api={state}
                onLoad={api => (state.npcs = api) && update()}
              />

              <DebugWorld
                api={state}
                onLoad={api => (state.debug = api) && update()}
              />

              <FOV
                api={state}
                onLoad={api => (state.fov = api) && update()}
              />

              <Origin />
              {/* <TestSprite/> */}
              {/* <TestRenderTexture/> */}
            </PanZoom>
          </QueryClientProvider>
        </Stage>
      )}
    </div>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {Geomorph.UseGeomorphsDefItem[]} gms
 * @property {string} worldKey
 */

/**
 * @typedef State
 * @property {boolean} disabled
 * @property {Graph.GmGraph} gmGraph
 * @property {Graph.GmRoomGraph} gmRoomGraph
 * 
 * @property {import("pixi.js").Application} pixiApp
 * @property {import("pixi.js").Renderer} renderer
 * 
 * @property {import("./DebugWorld").State} debug
 * @property {import("./Decor").State} decor
 * @property {import("./Doors").State} doors
 * @property {import("./FOV").State} fov
 * @property {import("./Geomorphs").State} geomorphs
 * @property {StateUtil & import("../service/npc").NpcServiceType} lib
 * @property {import("./NPCs").State} npcs
 * @property {import('./PanZoom').State} panZoom
 *
 * @property {() => boolean} isReady
 * @property {(displayObj: import("pixi.js").DisplayObject, tex: import("pixi.js").RenderTexture, clear?: boolean) => void} renderInto
 */

/**
 * @typedef StateUtil Utility classes and `rxjs` functions
 * @property {typeof import('../geom').Vect['isVectJson']} isVectJson
 * @property {typeof import('../geom').Vect['from']} vectFrom
 * @property {typeof filter} filter
 * @property {typeof first} first
 * @property {typeof map} map
 * @property {typeof merge} merge
 * @property {typeof precision} precision
 * @property {typeof removeFirst} removeFirst
 * @property {typeof take} take
 */
