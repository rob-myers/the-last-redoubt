import React from "react";
import { Stage } from "@pixi/react";

import { removeCached, setCached } from "../service/query-client";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useGeomorphs from "../geomorph/use-geomorphs";
import Geomorphs from "./Geomorphs";

/**
 * @param {Props} props
 */
export default function WorldPixi(props) {

  const state = useStateRef(/** @type {() => State} */ () => ({
    disabled: !!props.disabled,
    gmGraph: /** @type {State['gmGraph']} */ ({}),
    gmRoomGraph: /** @type {State['gmRoomGraph']} */ ({}),

    geomorphs: /** @type {State['geomorphs']} */  ({ ready: false }),
  }));

  const update = useUpdate();

  ({
    gmGraph: state.gmGraph,
    gmRoomGraph: state.gmRoomGraph
  } = useGeomorphs(props.gms, props.disabled));

  React.useEffect(() => {
    setCached(props.worldKey, state);
    return () => removeCached(props.worldKey);
  }, []);

  return state.gmGraph.ready ? (
    <Stage>
      <Geomorphs
        api={state}
        onLoad={api => (state.geomorphs = api) && update()}
      />
    </Stage>
  ) : null;
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
