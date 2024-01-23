import React from "react";
import { Subject } from "rxjs";
import { Viewport as PixiViewport } from "pixi-viewport";
import TWEEN from "@tweenjs/tween.js";
import debounce from "debounce";

import { Vect } from "../geom";
import { longClickMs } from "../service/const";
import { testNever } from "../service/generic";
import { Follow } from './follow-plugin';
import useStateRef from "../hooks/use-state-ref";
import Viewport from "./Viewport";

/**
 * API wrapper for <Viewport> i.e. pixi-viewport
 * @param {React.PropsWithChildren<Props>} props 
 */
export default function PanZoom(props) {
  const { api } = props;
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
    plugins: /** @type {*} */ ({}),
    tween: emptyTween,

    async animationAction(type) {
      switch (type) {
        case 'cancelPanZoom':
          state.tween.stop();
          break;
        case 'cancelFollow':
          state.plugins.remove('custom-follow');
          this.plugins.resume('drag');
          state.setZoomCenter(null);
          break;
        case 'pauseFollow':
          state.plugins.pause('custom-follow');
          this.plugins.resume('drag');
          state.setZoomCenter(null);
          break;
        case 'pause':
          state.tween.pause();
          break;
        case 'resumeFollow':
          state.plugins.resume('custom-follow');
          this.plugins.pause('drag');
          break;
        case 'play':
          state.tween.resume();
          state.plugins.resume('custom-follow');
          break;
        default:
          throw testNever(type, { suffix: 'animationAction' });
      }
    },
    follow(target, opts = { speed: 0 }) {
      // this.viewport.follow(/** @type {*} */ (target), opts);
      this.viewport.plugins.add('custom-follow', new Follow(this.viewport, /** @type {*} */ (target), opts));
      this.plugins.pause('drag');
      state.setZoomCenter(target);
    },
    getDomBounds() {
      return /** @type {HTMLDivElement} */ (api.canvas.parentElement).getBoundingClientRect();
    },
    getWorld(e) {
      return Vect.from(state.transform.localTransform.applyInverse(e.global)).precision(2);
    },
    isFollowing() {
      return !!state.viewport.plugins.get('custom-follow');
    },
    isIdle() {
      const { touches, isMouseDown } = state.input;
      return touches.length === 0 && !isMouseDown && !state.viewport.zooming;
    },
    async panZoomTo(opts) {
      state.tween.stop();

      const scale = opts.scale ?? state.viewport.scale.x;
      const point = opts.point ?? state.viewport.center.clone();
      const { width, height } = state.getDomBounds();

      state.tween = api.tween(state.viewport).to({
        scale: { x: scale, y: scale },
        x: -point.x * scale + width/2,
        y: -point.y * scale + height/2,
      }, opts.ms ?? 0).easing(TWEEN.Easing.Quadratic.Out);

      await state.tween.promise();
    },
    pointerdown(e) {
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
      if (e.nativeEvent.target === api.canvas) {
        state.events.next({ key: 'pointermove', point: state.getWorld(e), meta: {} });
      } // ignore pointermove outside viewport
    },
    pointerup(e) {
      if (!state.start.clientOrigin) {
        return;
      }

      const worldPoint = state.getWorld(e);
      const distance = tempVect.copy(e.client).distanceTo(state.start.clientOrigin);

      state.events.next({
        key: 'pointerup',
        meta: {// will be mutated by useHandleEvents
          distance,
          longClick: (Date.now() - state.start.epochMs) >= longClickMs,
          targetPos: {...worldPoint},
        },
        point: worldPoint,
        clickId: state.clickIds.pop(),
      });
    },
    onPanEnd: debounce(() => {
      state.isIdle() && state.events.next({ key: 'ui-idle' });
    }, 100),
    onZoomEnd: debounce(() => {
      state.isIdle() && state.events.next({ key: 'ui-idle' });
    }, 100),
    onZoom() {
      // NOOP
    },
    resize() {
      const rect = api.canvas.getBoundingClientRect();
      state.viewport.resize(rect.width, rect.height);
    },
    setFollowSpeed(speed) {
      const follow = state.plugins.get("follow");
      follow && (follow.options.speed = speed);
    },
    setZoomCenter(target) {
      const center = /** @type {import('@pixi/math').Point} */ (target);
      const plugin = /** @type {import('pixi-viewport').Wheel} */ (this.plugins.get('wheel'));
      plugin.options.center = center;
    },
    viewportRef(vp) {
      if (vp && !(state.viewport instanceof PixiViewport)) {
        state.viewport = vp;
        state.input = vp.input;
        state.transform = vp.transform;
        state.plugins = vp.plugins;
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
    state.resize();
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
 * @property {import("pixi-viewport").Viewport['plugins']} plugins
 * @property {NPC.TweenExt} tween For pan-zoom
 * 
 * @property {(type: 'cancelPanZoom' | 'cancelFollow' | 'pauseFollow' | 'resumeFollow' | 'pause' | 'play') => Promise<void>} animationAction
 * @property {(target: Geom.VectJson, opts?: import("pixi-viewport").IFollowOptions) => void} follow
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
 * @property {() => void} resize
 * @property {(speed: number) => void} setFollowSpeed
 * @property {(target: Geom.VectJson | null) => void} setZoomCenter
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
