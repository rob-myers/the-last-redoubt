import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Edges, PerspectiveCamera, useTexture } from "@react-three/drei";

/**
 * @param {Props} props
 */
export default function WorldGl(props) {
  return (
    <div style={{ backgroundColor: "white", height: "100%" }}>
      <Canvas>
        <ambientLight />
        <PerspectiveCamera
          makeDefault
          manual
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
  const texture = useTexture('/assets/geomorph/g-301--bridge.png');
  return (
    <mesh scale={[5, 1, 5]}>
      <boxGeometry args={[2, 0.1, 1]} />
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
