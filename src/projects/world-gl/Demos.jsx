import React from "react";
import THREE from "three";
import { useTexture, Edges } from "@react-three/drei";
import { gmScale } from "../world/const";

/**
 * ✅ custom geometry with origin at top-left
 * 🚧 transform -> (x, y, z)
 * 
 * @param {GeomorphProps} props 
 */
export function Geomorph(props) {
  const { gm } = props;

  const texture = useTexture(`/assets/geomorph/${gm.def.key}.lit.png`);
  const { width, height } = /** @type {HTMLImageElement} */ (texture.image);

  // 🚧 precompute Mat4?
  const scale = (1 / gmScale) * (1 / 60);
  // const mat4 = new THREE.Matrix4;
  // const otherMat4 = new THREE.Matrix4;
  // // mat4.scale(new THREE.Vector3(scale, 1, scale));

  // mat4.makeTranslation(gm.pngRect.x * scale, 0, gm.pngRect.y * scale);
  
  // otherMat4.setFromMatrix3(new THREE.Matrix3(
  //   gm.transform[0] * scale, 0, gm.transform[1] * scale,
  //   0, 1, 0,
  //   gm.transform[2] * scale, 0, gm.transform[3] * scale,
  // ).transpose())
  // otherMat4.setPosition(
  //   // (gm.pngRect.x + gm.transform[4]) * (1/60),
  //   gm.transform[4] * (1/60),
  //   0,
  //   // (gm.pngRect.y + gm.transform[5]) * (1/60),
  //    gm.transform[5] * (1/60),
  // );

  // mat4.multiply(otherMat4);

  
  // React.useEffect(() => {
  //   // 🚧 avoid re-run on HMR
  //   boxRef.current?.translate(width/2, 0, height/2);
  // }, []);

  // return (
  //   <mesh
  //     scale={[scale, 1, scale]}
  //     // matrix={mat4}
  //     // matrix-copy={null}
  //     // matrixAutoUpdate={false}
  //   >
  //     {/* 🚧 origin should be top-left, not centre */}
  //     {/* <boxGeometry ref={boxRef} args={[width, 0.1, height]} /> */}
  //     <boxGeometry args={[gm.pngRect.width * gmScale, 0.1, gm.pngRect.height * gmScale]} />
  //     <meshStandardMaterial color={"#aaa"} map={texture} transparent />
  //     <Edges
  //       // scale={1}
  //       scale={1.1}
  //       threshold={15} // degrees
  //       color="black"
  //     />
  //   </mesh>
  // );
  
  return (
    <mesh
      scale={[gm.pngRect.width * scale, 1, gm.pngRect.height * scale]}
      geometry={customPlaneGeometry}
      // matrix={mat4}
      // matrix-copy={null}
      // matrixAutoUpdate={false}
    >
      {/* 🚧 origin should be top-left, not centre */}
      {/* <boxGeometry ref={boxRef} args={[width, 0.1, height]} /> */}
      <meshStandardMaterial color={"#aaa"} map={texture} transparent />
      <Edges
        // scale={1.1}
        scale={1}
        threshold={15} // degrees
        color="white"
      />
    </mesh>
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

// https://codesandbox.io/s/react-three-fiber-custom-geometry-with-fragment-shader-material-vxswf?file=/src/index.js:2243-2262

export const customPlaneGeometry = new THREE.BufferGeometry();
const vertices = new Float32Array([
  0, 0, 0,
  1, 0, 1,
  1, 0, 0,

  0, 0, 0,
  0, 0, 1,
  1, 0, 1,
]);

const uvs = new Float32Array([
  1.0, 1.0,
  0.0, 0.0,
  0.0, 1.0,

  1.0, 1.0,
  1.0, 0.0,
  0.0, 0.0,
]);

const indices = [
  0, 1, 2,
  3, 4, 5
];
customPlaneGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
customPlaneGeometry.setAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );
customPlaneGeometry.setIndex(indices);
