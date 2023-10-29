import React from "react";
import useStateRef from "../hooks/use-state-ref";
import { DemoScene } from "./Demos";

/**
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const state = useStateRef(
    /** @type {() => State} */ () => ({
      ready: true,
    })
  );

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <DemoScene/>
  );
}

/**
 * @typedef Props @type {object}
 * @property {import('./WorldGl').State} api
 * @property {(doorsApi: State) => void} onLoad
 */

/**
 * @typedef State @type {object}
 * @property {boolean} ready
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
