import React from "react";
import THREE from "three";
import { Edges } from "@react-three/drei";
import { gmScale } from "../world/const";
import useStateRef from "../hooks/use-state-ref";
import { Geomorph, customQuadGeometry } from "./Misc";
import { useQueries, useQuery } from "react-query";

/**
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { api } = props;
  const { gmGraph: { gms } } = api;

  const litRes = useQueries(// async texture loading
    gms.map(gm => ({
      queryKey: `${gm.key}.lit`,
      queryFn: () => textLoader.loadAsync(`/assets/geomorph/${gm.key}.lit.webp`)
      // queryFn: () => textLoader.loadAsync(`/assets/geomorph/${gm.key}.webp`)
    })),
  );

  const state = useStateRef(
    /** @type {() => State} */ () => ({
      ready: true,
      tex: { lit: {}, unlit: {} },

      mat4s: gms.map((gm, gmId) => (
        new THREE.Matrix4(
          gm.transform[0], 0, gm.transform[2], gm.transform[4] * scale,
          // 0, 1, 0, gmId * 0.000001, // hack to fix z-fighting
          0, 1, 0, 0,
          gm.transform[1], 0, gm.transform[3], gm.transform[5] * scale,
          0, 0, 0, 1,
        )
      )),
    }),
  );

  gms.forEach((gm, gmId) => {
    // state.tex.unlit[gm.key] ??= unlitRes[gmId];
    state.tex.lit[gm.key] ??= litRes[gmId].data;
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
        {state.tex.lit[gm.key] && <mesh
          scale={[gm.pngRect.width * scale, 1, gm.pngRect.height * scale]}
          geometry={customQuadGeometry}
          position={[gm.pngRect.x * scale, 0, gm.pngRect.y * scale]}
          // position={[gm.pngRect.x * scale + (gmId === 2 ? 4 * scale : 0), 0, gm.pngRect.y * scale + (gmId === 2 ? -2 * scale : 0)]}
        >
          <meshStandardMaterial
            transparent
            // toneMapped
            // color="#999"
            // toneMapped={false}
            map={state.tex.lit[gm.key]}
            // emissive={new THREE.Color(0.1, 0.1, 0.1)}
            // Improves look, but causes issue with hull overlap
            // 🚧 try simulating in geomorph-render instead
            // alphaMap={state.tex.lit[gm.key]}
          />
          {/* <Edges
            // scale={1.1}
            scale={1}
            threshold={15} // degrees
            color="red"
          /> */}
        </mesh>}
      </group>
    )}
  </>;
}

/**
 * @typedef Props @type {object}
 * @property {import('./WorldR3f').State} api
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

const textLoader = new THREE.TextureLoader();
