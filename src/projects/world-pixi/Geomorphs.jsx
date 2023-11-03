import React from "react";
import { useQueries, useQuery } from "react-query";
import { Container, Sprite } from "@pixi/react";
import { Assets } from "@pixi/assets";
import { gmScale } from "../world/const";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { api } = props;
  const { gmGraph: { gms } } = api;

  const litRes = useQueries(
    gms.map(gm => ({
      queryKey: `${gm.key}.lit`,
      /** @returns {Promise<import('pixi.js').Texture>} */
      queryFn: () => Assets.load(`/assets/geomorph/${gm.key}.lit.webp`)
    })),
  );
  
  const state = useStateRef(
    /** @type {() => State} */ () => ({
      ready: true,
    }),
  );

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return <>
    {gms.map((gm, gmId) =>
      litRes[gmId].data && (
        <Container
          key={gmId}
          {...decomposeBasicTransform(gm.transform)}
        >
          <Sprite
            width={gm.pngRect.width}
            height={gm.pngRect.height}
            texture={litRes[gmId].data}
            position={{ x: gm.pngRect.x, y: gm.pngRect.y }}
          />
        </Container>
      )
    )}
  </>;
}

/**
 * @param {Geom.SixTuple} transform
 * `[a, b, c, d]` are ±1 and invertible
 */
function decomposeBasicTransform([a, b, c, d, e, f]) {
  let degrees = 0, scaleX = 1, scaleY = 1;
  if (a === 1) {// degrees is 0
    scaleY = d;
  } else if (a === -1) {
    degrees = 180;
    scaleY = -d;
  } else if (b === 1) {
    degrees = 90;
    scaleX = -c;
  } else if (b === -1) {
    degrees = 270;
    scaleX = c;
  }

  return {
    scale: { x: scaleX, y: scaleY },
    angle: degrees,
    x: e,
    y: f,
  };
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
