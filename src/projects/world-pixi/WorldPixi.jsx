import React from "react";
import { Stage } from "@pixi/react";
import { QueryClientProvider } from "react-query";
import useMeasure from "react-use-measure";

import { queryClient, removeCached, setCached } from "../service/query-client";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useGeomorphs from "../geomorph/use-geomorphs";
import Viewport from "./Viewport";
import Geomorphs from "./Geomorphs";

/**
 * @param {Props} props
 */
export default function WorldPixi(props) {

  const state = useStateRef(/** @type {() => State} */ () => ({
    disabled: !!props.disabled,
    gmGraph: /** @type {*} */ ({}),
    gmRoomGraph: /** @type {*} */ ({}),

    pixiApp: /** @type {*} */ ({}),
    viewport: /** @type {*} */ ({}),

    geomorphs: /** @type {State['geomorphs']} */  ({ ready: false }),
  }));

  const update = useUpdate();
  const [rootRef, bounds] = useMeasure();

  ({
    gmGraph: state.gmGraph,
    gmRoomGraph: state.gmRoomGraph
  } = useGeomorphs(props.gms, props.disabled));

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
            // resolution: 4, // ℹ️ no zoom flicker, but can set on filter
          }}
          onMount={app => state.pixiApp = app}
          width={bounds.width || undefined}
          height={bounds.height || undefined}
        >
          <QueryClientProvider client={queryClient} >
            <Viewport
              ref={vp => vp && (state.viewport = vp)}
              initScale={0.5}
            >
              <Geomorphs
                api={state}
                onLoad={api => (state.geomorphs = api) && update()}
              />
            </Viewport>
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
 * @property {import("pixi-viewport").Viewport} viewport
 * 
 * //@property {import("./DebugWorld").State} debug
 * //@property {import("./Decor").State} decor
 * //@property {import("./Doors").State} doors
 * //@property {import("./FOV").State} fov
 * @property {import("./Geomorphs").State} geomorphs
 * //@property {() => boolean} isReady
 * //@property {StateUtil & import("../service/npc").NpcServiceType} lib
 * //@property {import("./NPCs").State} npcs
 * //@property {PanZoom.CssApi} panZoom
 */
