import React from "react";
import { Subject } from "rxjs";
import { Animate } from "pixi-viewport";

import { Vect } from "../geom";
import { longClickMs } from "../service/const";
import useStateRef from "../hooks/use-state-ref";
import Viewport from "./Viewport";
import debounce from "debounce";

/**
 * API wrapper for <Viewport> i.e. pixi-viewport
 * @param {React.PropsWithChildren<Props>} props 
 */
export default function PanZoom(props) {


  const state = useStateRef(
    /** @type {() => State} */ () => ({
      ready: true,
      events: new Subject,
      clickIds: [],
      start: {
        origin: undefined,
        clientOrigin: undefined,
        scale: 1,
        distance: 0, // on canvas
        epochMs: -1,
      },

      viewport: /** @type {*} */ ({}),
      input: /** @type {*} */ ({}),
      transform: /** @type {*} */ ({}),
      plugins: /** @type {*} */ ({}),
      animate: /** @type {*} */ ({}),

      getWorld(e) {
        return state.transform.localTransform.applyInverse(e.global);
      },
      isFollowing() {
        return !!state.plugins.get('follow');
      },
      isIdle() {
        const { touches, isMouseDown } = state.input;
        return touches.length === 0 && !isMouseDown && !state.viewport.zooming;
      },
      pointerdown(e) {
        !state.isFollowing() && state.animate.complete(); // cancel?
        const origin = state.getWorld(e);
        state.start = {
          origin,
          clientOrigin: { x: e.client.x, y: e.client.y },
          scale: state.viewport.scale.x,
          distance: 0, // or getDistance(state.input.touches)
          epochMs: Date.now(),
        };
      },
      pointermove(e) {
        // 🚧 emit for hit-testing in use-handle-events
      },
      pointerup(e) {
        if (!state.start.clientOrigin) {
          return;
        }

        const worldPoint = state.getWorld(e);
        const distance = tempVect.copy(e.client).distanceTo(state.start.clientOrigin);
        // console.log("pointerup", worldPoint);

        state.events.next({
          key: 'pointerup',
          meta: {
            distance,
            longClick: (Date.now() - state.start.epochMs) >= longClickMs,
            targetPos: worldPoint, // 🚧 needs ctxt
          },
          point: worldPoint,
          clickId: state.clickIds.pop(),
        });
      },
      onPanEnd() {
        state.isIdle() && state.events.next({ key: 'ui-idle' });
      },
      onZoomEnd: debounce(() => {
        state.isIdle() && state.events.next({ key: 'ui-idle' });
      }, 100),
      viewportRef(vp) {
        if (vp) {
          state.viewport = vp;
          state.input = vp.input;
          state.transform = vp.transform;
          state.plugins = vp.plugins;
          state.animate = new Animate(vp);
          vp.plugins.add('animate', state.animate);
        }
      },
    })
    );

    React.useEffect(() => {
      const { viewport: vp, onPanEnd, onZoomEnd } = state;
      vp.addEventListener('moved-end', onPanEnd);
      vp.addEventListener('zoomed-end', onZoomEnd);
      props.onLoad(state);
      return () => {
        state.viewport.removeEventListener('moved-end', onPanEnd);
        state.viewport.removeEventListener('zoomed-end', onZoomEnd);
      };
  }, []);

  return (
    <Viewport
      ref={state.viewportRef}
      initScale={0.5}
      pointerdown={state.pointerdown}
      pointermove={state.pointermove}
      pointerup={state.pointerup}
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
 * @property {{ origin?: Geom.VectJson; clientOrigin?: Geom.VectJson; epochMs: number; scale: number; distance: number; }} start
 * @property {string[]} clickIds
 * Pending click identifiers, provided by code external to CssPanZoom.
 * The last click identifier is the "current one".
 *
 * @property {import("pixi-viewport").Viewport} viewport
 * @property {import("pixi-viewport").Viewport['input']} input
 * @property {import("pixi-viewport").Viewport['transform']} transform
 * @property {import("pixi-viewport").Viewport['plugins']} plugins
 * @property {import("pixi-viewport").Animate} animate
 * 
 * @property {(e: import('@pixi/events').FederatedPointerEvent) => Geom.VectJson} getWorld
 * @property {() => boolean} isFollowing
 * @property {() => boolean} isIdle
 * @property {(e: import('@pixi/events').FederatedPointerEvent) => void} pointerdown
 * @property {(e: import('@pixi/events').FederatedPointerEvent) => void} pointermove
 * @property {(e: import('@pixi/events').FederatedPointerEvent) => void} pointerup
 * @property {() => void} onPanEnd
 * @property {() => void} onZoomEnd
 * @property {(vp: null | import("pixi-viewport").Viewport) => void} viewportRef
 */

const tempVect = new Vect;
