import React from "react";
import { gmScale } from "../world/const";
import useStateRef from "../hooks/use-state-ref";
import { useQueries, useQuery } from "react-query";
import { Sprite } from "@pixi/react";

/**
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { api } = props;
  const { gmGraph: { gms } } = api;

//   const litRes = useQueries(// async texture loading
//     gms.map(gm => ({
//       queryKey: `${gm.key}.lit`,
//       queryFn: () => textLoader.loadAsync(`/assets/geomorph/${gm.key}.lit.webp`)
//       // queryFn: () => textLoader.loadAsync(`/assets/geomorph/${gm.key}.webp`)
//     })),
//   );

  const state = useStateRef(
    /** @type {() => State} */ () => ({
      ready: true,
    }),
  );

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return <>
    <Sprite
      image="/assets/geomorph/g-301--bridge.lit.webp"
    />
    {/* {gms.map((gm, gmId) =>
      //
    )} */}
  </>;
}

/**
 * @typedef Props @type {object}
 * @property {import('./WorldPixi').State} api
 * @property {(doorsApi: State) => void} onLoad
 */

/**
 * @typedef State @type {object}
 * @property {boolean} ready
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
