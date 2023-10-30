import React from "react";
import THREE from "three";
import { useTexture, Edges } from "@react-three/drei";
import { gmScale } from "../world/const";

/**
 * - Undo image scale (i.e. `gmScale`).
 * - Next, `1/60` -> 1 grid side -> `1.5m`
 */
const scale = (1 / gmScale) * (1 / 60) * (2 / 3);

/**
 * @param {GeomorphProps} props 
 */
export function Geomorph(props) {
  const { gm } = props;

  const texture = useTexture(`/assets/geomorph/${gm.def.key}.lit.png`);

  // 🚧 precompute Mat4
  const mat4 = new THREE.Matrix4;
  mat4.setFromMatrix3(new THREE.Matrix3(
    gm.transform[0], 0, gm.transform[1],
    0, 1, 0,
    gm.transform[2], 0, gm.transform[3],
  ).transpose())
  // ℹ️ y component avoids z-fighting
  mat4.setPosition(gm.transform[4] * scale, gm.gmId * 0.00001,  gm.transform[5] * scale);

  return (
    <group onUpdate={self => self.applyMatrix4(mat4)}>
      <mesh
        scale={[gm.pngRect.width * scale, 1, gm.pngRect.height * scale]}
        geometry={customQuadGeometry}
        position={[gm.pngRect.x * scale, 0, gm.pngRect.y * scale]}
      >
        <meshStandardMaterial color={"#aaa"} map={texture} transparent />
        {/* <Edges
          // scale={1.1}
          scale={1}
          threshold={15} // degrees
          color="white"
        /> */}
      </mesh>
    </group>
  );
}

/**
 * @typedef GeomorphProps
 * @property {Geomorph.GeomorphDataInstance} gm
 */

export function Origin() {
  return (
    <mesh scale={[0.1, 0.1, 0.1]} position={[0, 0.05, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="red" />
    </mesh>
  )
}

export const customQuadGeometry = new THREE.BufferGeometry();
const vertices = new Float32Array([
  0, 0, 0,
  1, 0, 1,
  1, 0, 0,
  0, 0, 1,
]);

const uvs = new Float32Array([
  1.0, 1.0,
  0.0, 0.0,
  0.0, 1.0,
  1.0, 0.0,
]);

const indices = [
  0, 1, 2,
  0, 3, 1
];
customQuadGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
customQuadGeometry.setAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );
customQuadGeometry.setIndex(indices);
