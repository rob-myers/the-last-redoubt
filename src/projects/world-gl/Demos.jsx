import React from "react";
import { useTexture, Edges } from "@react-three/drei";
import { gmScale } from "../world/const";

export function DemoScene() {
  const texture = useTexture("/assets/geomorph/g-301--bridge.lit.png");
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
