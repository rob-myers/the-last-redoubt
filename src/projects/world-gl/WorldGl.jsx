import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Edges, PerspectiveCamera, useTexture, MapControls } from "@react-three/drei";
import { gmScale } from "../world/const";

/**
 * @param {Props} props
 */
export default function WorldGl(props) {
  // const camRef = /** @type {React.RefObject<THREE.PerspectiveCamera>} */ (React.useRef(null));
  return (
    <div style={{ backgroundColor: "white", height: "100%" }}>
      <Canvas>
        <MapControls />
        <ambientLight intensity={5} />
        <PerspectiveCamera
          // ref={camRef}
          makeDefault
          // manual
          position={[0, 10, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        <Suspense fallback={null}>
          <DemoScene />
        </Suspense>
      </Canvas>
    </div>
  );
}

/**
 * @typedef Props
 * @property {string} worldKey
 * @property {boolean} [disabled]
 */

function DemoScene() {
  const texture = useTexture('/assets/geomorph/g-301--bridge.lit.png');
  const { width, height } = /** @type {HTMLImageElement} */ (texture.image);
  const scale = (1 / gmScale) * (1 / 60);

  return (
    <mesh scale={[scale, 1, scale]}>
      <boxGeometry args={[width, 0.1, height]} />
      <meshStandardMaterial color={"#aaa"} map={texture} transparent />
      <Edges
        // scale={1}
        scale={1.1}
        threshold={15} // degrees
        color="black"
      />
    </mesh>
  );
}
