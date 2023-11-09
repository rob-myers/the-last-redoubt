import React from "react";
import useStateRef from "../hooks/use-state-ref";
import Viewport from "./Viewport";

/**
 * API wrapper for <Viewport> i.e. pixi-viewport
 * @param {React.PropsWithChildren<Props>} props 
 */
export default function PanZoom(props) {

  const state = useStateRef(
    /** @type {() => State} */ () => ({
      ready: true,
      viewport: /** @type {*} */ ({}),
    })
  );

  return (
    <Viewport
      ref={(vp) => vp && (state.viewport = vp)}
      initScale={0.5}
      pointerup={
        /** @param {import('@pixi/events').FederatedPointerEvent} e */ (e) => {
          const worldPoint =
            state.viewport.transform.localTransform.applyInverse(e.global);
          console.log("pointerup", worldPoint);
        }
      }
      // pointermove={/** @param {import('@pixi/events').FederatedPointerEvent} e */ e => {
      //   console.log('pointermove', e.global, e.offset);
      // }}
    >
      {props.children}
    </Viewport>
  );
}

/**
 * @typedef Props
 * @property {import('./WorldPixi').State} api
 * @property {(panZoomApi: State) => void} onLoad
 */


/**
 * @typedef State
 * @property {boolean} ready
 * @property {import("pixi-viewport").Viewport} viewport
 */
