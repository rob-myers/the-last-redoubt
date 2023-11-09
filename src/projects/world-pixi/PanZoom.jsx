import React from "react";
import { Subject } from "rxjs";
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
      events: new Subject,
      viewport: /** @type {*} */ ({}),
      clickIds: [],
    })
  );

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return (
    <Viewport
      ref={(vp) => vp && (state.viewport = vp)}
      initScale={0.5}
      pointerup={
        /** @param {import('@pixi/events').FederatedPointerEvent} e */ (e) => {
          const worldPoint = state.viewport.transform.localTransform.applyInverse(e.global);
          // console.log("pointerup", worldPoint);
          state.events.next({
            key: 'pointerup',
            meta: {
              distance: 0, // 🚧
              longClick: false, // 🚧
              targetPos: worldPoint, // 🚧
            },
            point: worldPoint,
            clickId: state.clickIds.pop(),
          });
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
 * @property {Subject<PanZoom.CssInternalEvent>} events
 * @property {import("pixi-viewport").Viewport} viewport
 * @property {string[]} clickIds
 * Pending click identifiers, provided by code external to CssPanZoom.
 * The last click identifier is the "current one".
 */
