import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, MapControls } from "@react-three/drei";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import Geomorphs from "./Geomorphs";

/**
 * @param {Props} props
 */
export default function WorldGl(props) {
  // const camRef = /** @type {React.RefObject<THREE.PerspectiveCamera>} */ (React.useRef(null));

  const state = useStateRef(/** @type {() => State} */ () => ({
    disabled: !!props.disabled,
    geomorphs: /** @type {State['geomorphs']} */  ({ ready: false }),
  }));
  const update = useUpdate();

  return (
    <Canvas>
      <MapControls />
      <ambientLight intensity={5} />
      <PerspectiveCamera
        // ref={camRef}
        // manual
        makeDefault
        position={[0, 10, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <Suspense fallback={null}>
        <Geomorphs
          api={state}
          onLoad={api => (state.geomorphs = api) && update()}
        />
      </Suspense>
    </Canvas>
  );
}

/**
 * @typedef Props
 * @property {string} worldKey
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {boolean} disabled
 * //@property {Graph.GmGraph} gmGraph
 * //@property {Graph.GmRoomGraph} gmRoomGraph
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
