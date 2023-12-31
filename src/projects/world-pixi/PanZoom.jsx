import React from "react";
import { Subject } from "rxjs";
import { Viewport as PixiViewport } from "pixi-viewport";
import TWEEN from "@tweenjs/tween.js";
import debounce from "debounce";

import { Vect } from "../geom";
import { longClickMs } from "../service/const";
import { testNever } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";
import Viewport from "./Viewport";

/**
 * API wrapper for <Viewport> i.e. pixi-viewport
 * @param {React.PropsWithChildren<Props>} props 
 */
export default function PanZoom(props) {
  const state = useStateRef(/** @type {() => State} */ () => ({
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
    tween: emptyTween,

    async animationAction(type) {
      switch (type) {
        case 'cancelPanZoom':
          state.tween.stop();
          break;
        case 'cancelFollow':
          // 🚧 cancel follow
          break;
        case 'pause':
          state.tween.pause();
          // 🚧 pause follow
          break;
        case 'play':
          state.tween.resume();
          // 🚧 resume follow
          break;
        default:
          throw testNever(type, { suffix: 'animationAction' });
      }
    },
    getDomBounds() {
      return /** @type {HTMLDivElement} */ (props.api.canvas.parentElement).getBoundingClientRect();
    },
    getWorld(e) {
      return state.transform.localTransform.applyInverse(e.global);
    },
    isFollowing() {
      return !!state.viewport.plugins.get('follow');
    },
    isIdle() {
      const { touches, isMouseDown } = state.input;
      return touches.length === 0 && !isMouseDown && !state.viewport.zooming;
    },
    async panZoomTo(opts) {
      state.tween.stop();

      const scale = opts.scale ?? state.viewport.scale.x;
      const point = opts.point ?? state.viewport.position.clone();
      const { width, height } = state.getDomBounds();

      state.tween = props.api.tween(state.viewport).to({
        scale: { x: scale, y: scale },
        x: -point.x * scale + width/2,
        y: -point.y * scale + height/2,
      }, opts.ms ?? 0).easing(TWEEN.Easing.Quadratic.Out);
      return state.tween.promise();
    },
    pointerdown(e) {
      // !state.isFollowing() && state.animate.complete(); // cancel?
      state.tween.stop();
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
      if (e.nativeEvent.target === props.api.canvas) {
        state.events.next({ key: 'pointermove', point: state.getWorld(e) });
      } // ignore pointermove outside viewport
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
          targetPos: worldPoint, // 🚧 remove?
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
    onZoom() {
      // console.log(state.viewport.scale.x);
    },
    viewportRef(vp) {
      if (vp && !(state.viewport instanceof PixiViewport)) {
        state.viewport = vp;
        state.input = vp.input;
        state.transform = vp.transform;
        state.viewport.scale.set(props.initScale ?? 1);
      }
    },
  }));

  React.useEffect(() => {
    const { viewport: vp, onPanEnd, onZoomEnd, onZoom } = state;
    // vp.plugins.add('animate', state.animate = new Animate(vp));
    vp.addEventListener('moved-end', onPanEnd);
    vp.addEventListener('zoomed-end', onZoomEnd);
    vp.addEventListener('zoomed', onZoom);
    props.onLoad(state);
    return () => {
      // vp.plugins.remove('animate');
      state.viewport.removeEventListener('moved-end', onPanEnd);
      state.viewport.removeEventListener('zoomed-end', onZoomEnd);
      state.viewport.removeEventListener('zoomed', onZoom);
    };
  }, []);

  return (
    <Viewport
      ref={state.viewportRef}
      // initScale={0.5}
      eventMode="dynamic"
      pointerdown={state.pointerdown}
      pointermove={state.pointermove}
      pointerup={state.pointerup}
    >
      {props.children}
    </Viewport>
  );
}

/**
 * @typedef Props
 * @property {import('./WorldPixi').State} api
 * @property {(panZoomApi: State) => void} onLoad
 * @property {number} [initScale]
 */


/**
 * @typedef State
 * @property {boolean} ready
 * @property {Subject<PanZoom.InternalEvent>} events
 * @property {{ origin?: Geom.VectJson; clientOrigin?: Geom.VectJson; epochMs: number; scale: number; distance: number; }} start
 * @property {string[]} clickIds
 * Pending click identifiers, provided by code external to CssPanZoom.
 * The last click identifier is the "current one".
 *
 * @property {import("pixi-viewport").Viewport} viewport
 * @property {import("pixi-viewport").Viewport['input']} input
 * @property {import("pixi-viewport").Viewport['transform']} transform
 * @property {NPC.TweenExt} tween For pan-zoom
 * 
 * @property {(type: 'cancelPanZoom' | 'cancelFollow' | 'pause' | 'play') => Promise<void>} animationAction
 * @property {() => DOMRect} getDomBounds
 * @property {(e: import('@pixi/events').FederatedPointerEvent) => Geom.VectJson} getWorld
 * @property {() => boolean} isFollowing
 * @property {() => boolean} isIdle
 * @property {(opts: PanZoomOpts) => Promise<any>} panZoomTo
 * @property {(e: import('@pixi/events').FederatedPointerEvent) => void} pointerdown
 * @property {(e: import('@pixi/events').FederatedPointerEvent) => void} pointermove
 * @property {(e: import('@pixi/events').FederatedPointerEvent) => void} pointerup
 * @property {() => void} onPanEnd
 * @property {() => void} onZoomEnd
 * @property {() => void} onZoom
 * @property {(vp: null | import("pixi-viewport").Viewport) => void} viewportRef
 */

/**
 * @typedef PanZoomOpts
 * @property {number} ms
 * @property {number} [scale]
 * @property {Geom.VectJson} [point]
 * @property {string} [easing]
*/

const tempVect = new Vect;

/** @type {NPC.TweenExt} */
const emptyTween = Object.assign(new TWEEN.Tween({}), {
  promise: () => Promise.resolve({}),
});
