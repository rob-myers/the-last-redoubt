import React from "react";
import THREE from "three";
import { useLoader } from "@react-three/fiber";
import { useTexture, Edges } from "@react-three/drei";
import { gmScale } from "../world/const";
import useStateRef from "../hooks/use-state-ref";
import { Geomorph, customQuadGeometry } from "./Misc";

/**
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { api } = props;
  const { gmGraph: { gms } } = api;

  // ℹ️ tried writing to state via onLoad callback, but lighting seemed wrong
  const unlitTex = useTexture(gms.map((gm) => `/assets/geomorph/${gm.key}.png`));
  const litTex = useTexture(gms.map((gm) => `/assets/geomorph/${gm.key}.lit.png`));

  const state = useStateRef(
    /** @type {() => State} */ () => ({
      ready: true,
      tex: { lit: {}, unlit: {} },

      mat4s: gms.map((gm, gmId) => (
        new THREE.Matrix4(
          gm.transform[0], 0, gm.transform[2], gm.transform[4] * scale,
          0, 1, 0, gmId * 0.00001, // hack to fix z-fighting
          gm.transform[1], 0, gm.transform[3], gm.transform[5] * scale,
          0, 0, 0, 1,
        )
      )),
    }),
  );

  gms.forEach((gm, gmId) => {
    state.tex.unlit[gm.key] ??= unlitTex[gmId];
    state.tex.lit[gm.key] ??= litTex[gmId];
  });

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return <>
    {gms.map((gm, gmId) =>
      // <Geomorph key={gmId} gm={gm} />
      <group
        key={gmId}
        onUpdate={self => self.applyMatrix4(state.mat4s[gmId])}
      >
        <mesh
          scale={[gm.pngRect.width * scale, 1, gm.pngRect.height * scale]}
          geometry={customQuadGeometry}
          position={[gm.pngRect.x * scale, 0, gm.pngRect.y * scale]}
        >
          <meshStandardMaterial
            color={"#aaa"}
            transparent
            {...state.tex.lit[gm.key] && {map: state.tex.lit[gm.key]}}
          />
        </mesh>
      </group>
    )}
  </>;
}

/**
 * @typedef Props @type {object}
 * @property {import('./WorldGl').State} api
 * @property {(doorsApi: State) => void} onLoad
 */

/**
 * @typedef State @type {object}
 * @property {boolean} ready
 * @property {{ [key in 'lit' | 'unlit']: Partial<Record<Geomorph.GeomorphKey, THREE.Texture>> }} tex
 * @property {THREE.Matrix4[]} mat4s
 * 
 * 
 * //@property {boolean[][]} isRoomLit
 * Lights on iff `isRoomLit[gmId][roomId]`.
 * //@property {(type: 'lit' | 'unlit', ctxt: CanvasRenderingContext2D, gmId: number) => CanvasPattern} createFillPattern
 * //@property {(type: 'lit' | 'unlit', gmId: number, poly: Geom.Poly) => void} drawPolygonImage
 * Fill polygon using unlit image, and also darken.
 * //@property {(type: 'lit' | 'unlit', gmId: number, rect: Geom.RectJson) => void} drawRectImage
 * //@property {() => void} initDrawIds
 * //@property {(gmId: number) => void} initLightRects
 * Currently assumes all doors initially closed
 * //@property {() => () => void} loadImages Returns cleanup
 * //@property {(gmId: number, doorId: number) => void} onOpenDoor
 * //@property {(gmId: number, doorId: number, lightCurrent?: boolean) => void} onCloseDoor
 * //@property {(gmId: number, roomId: number)  => void} recomputeLights
 * //@property {(gmId: number, roomId: number, lit: boolean)  => void} setRoomLit
 */

/**
 * - Undo image scale (i.e. `gmScale`).
 * - Next, `1/60` -> 1 grid side -> `1.5m`
 */
const scale = (1 / gmScale) * (1 / 60) * (2 / 3);
