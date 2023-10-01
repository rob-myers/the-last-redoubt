/**
 * Based on @panzoom/panzoom with substantial changes
 * https://www.npmjs.com/package/@panzoom/panzoom
 */
import React from "react";
import { css, cx } from "@emotion/css";
import { Subject } from "rxjs";
import useMeasure from "react-use-measure";
import { Vect } from "../geom";
import { keys, precision, safeJsonParse, testNever } from "../service/generic";
import { longClickMs } from "../service/const";
import { isAnimAttached } from "../service/dom";
import useStateRef from "../hooks/use-state-ref";

/** @param {React.PropsWithChildren<Props>} props */
export default function CssPanZoom(props) {

  const state = useStateRef(/** @type {() => PanZoom.CssApi} */ () => {
    return {
      ready: true,
      opts: { minScale: 0.5, maxScale: 10, step: 0.05, idleMs: 200 },

      rootEl: /** @type {HTMLDivElement} */ ({}),
      panzoomEl: /** @type {HTMLDivElement} */ ({}),
      panzoomAnim: null,
      
      followEl: /** @type {HTMLDivElement} */ ({}),
      followAnim: null,

      x: 0,
      y: 0,
      scale: 1,
      
      ptrsAllDown: false,
      pointers: [],
      origin: undefined,
      start: {
        clientX: undefined,
        clientY: undefined,
        scale: 1,
        distance: 0,
        epochMs: -1,
      },
      events: new Subject,
      idleTimeoutId: 0,
      clickIds: [],

      evt: {
        wheel(e) {
          state.isIdle() && state.events.next({ key: 'started-wheel' });
          state.delayIdle();
          // Permit manual panzoom whilst following
          !state.isFollowing() && state.animationAction('cancel');
          state.zoomWithWheel(e);
        },
        pointerdown(e) {
          state.delayIdle();
          ensurePointer(state.pointers, e);
          !state.isFollowing() && state.animationAction('cancel');

          state.ptrsAllDown = true;
          state.origin = new Vect(state.x, state.y);

          const point = getMiddle(state.pointers);
          state.start = {
            clientX: point.clientX,
            clientY: point.clientY,
            scale: state.scale,
            distance: getDistance(state.pointers),
            epochMs: Date.now(),
          };
        },
        pointermove(e) {
          if (
            state.origin === undefined
            || state.start.clientX === undefined
            || state.start.clientY === undefined
          ) {
            return;
          }

          state.delayIdle();
          ensurePointer(state.pointers, e);
          const current = getMiddle(state.pointers);

          if (state.pointers.length > 1) {
            // A startDistance of 0 means there weren't 2 pointers handled on start
            if (state.start.distance === 0) {
              state.start.distance = getDistance(state.pointers);
            }
            const diff = getDistance(state.pointers) - state.start.distance
            const dstScale = state.clampScale(
              (state.scale) + (diff * 3 * state.opts.step) / 80
            );
            state.zoomToClient(dstScale, current);
          } else {
            if (state.isFollowing()) {
              // no dragging whilst following else discontinuous on stop follow
              state.start.clientX = state.start.clientY = undefined;
              return;
            }

            // Panning during pinch zoom can cause issues 
            // See https://github.com/timmywil/panzoom/issues/512
            const nextX = state.origin.x + (current.clientX - state.start.clientX);
            const nextY = state.origin.y + (current.clientY - state.start.clientY);

            if (state.x !== nextX || state.y !== nextY) {
              state.x = nextX;
              state.y = nextY;
              state.setStyles();
            }
          }
        },
        pointerup(e) {
          /**
           * NOTE: don't remove all pointers.
           * Can restart without having to reinitiate all of them.
           * Remove the pointer regardless of the isPanning state.
           */
          removePointer(state.pointers, e);
          if (!state.ptrsAllDown) {
            return;
          }

          const worldPointerUp = state.getWorld(e);
          // Provide world position of target element centre
          const el = /** @type {HTMLElement} */ (e.target);
          const { x, y, width, height } = el.getBoundingClientRect();
          const targetPos = state.getWorld({ clientX: x + (width/2), clientY: y + (height/2) });

          // Distance is approx because state.scale may change
          const distance = new Vect(
            e.clientX - /** @type {number} */ (state.start.clientX),
            e.clientY - /** @type {number} */ (state.start.clientY),
          ).scale(1 / state.scale).length;

          /** @type {PanZoom.CssPointerUpEvent['meta']} */
          const meta = { ...el.dataset.meta && safeJsonParse(el.dataset.meta),
            targetPos: { x: precision(targetPos.x), y: precision(targetPos.y) },
            longClick: (Date.now() - state.start.epochMs) >= longClickMs,
            distance,
          };

          state.events.next({
            key: 'pointerup',
            point: worldPointerUp,
            meta,
            clickId: state.clickIds.pop(),
          });

          state.ptrsAllDown = false;
          state.origin = state.start.clientX = state.start.clientY = undefined;
          // state.clearTransition();
        },
      },

      async animationAction(type) {
        switch (type) {
          case 'cancel': {
            // 🤔 don't cancel tracking when cancelling panzoom
            state.syncStyles();
            const anim = state.panzoomAnim;
            anim && isAnimAttached(anim, state.panzoomEl) && await new Promise(resolve => {
              anim.addEventListener('cancel', resolve)
              anim.cancel();
            });
            state.panzoomAnim === anim && (state.panzoomAnim = null);
            break;
          }
          case 'cancelFollow': {
            const anim = state.followAnim;
            anim && isAnimAttached(anim, state.followEl) && await new Promise(resolve => {
              anim.addEventListener('cancel', resolve)
              anim.commitStyles();
              anim.cancel();
            });
            state.followAnim === anim && (state.followAnim = null);
            break;
          }
          case 'pause': // Avoid pausing finished animation
            state.panzoomAnim?.playState === 'running' && state.panzoomAnim.pause();
            state.followAnim?.playState === 'running' && state.followAnim.pause();
            break;
          case 'play':
            state.panzoomAnim?.playState === 'paused' && state.panzoomAnim.play();
            state.followAnim?.playState === 'paused' && state.followAnim.play();
            break;
          default:
            throw testNever(type, { suffix: 'animationAction' });
        }
      },
      clampScale(input) {
        return Math.min(Math.max(input, state.opts.minScale), state.opts.maxScale);
      },
      computePathKeyframes(path, animScaleFactor) {
        /** Duration of initial pan (even if close) */
        const initPanMs = 500;
        /** How far npc walks along path during initial pan */
        const distAlongPath = initPanMs / animScaleFactor;

        /** `elens[i]` is length of edge incoming to vertex `path[i]` */
        const elens = path.map((p, i) => i === 0 ? 0 : p.distanceTo(path[i - 1]));
        const total = elens.reduce((sum, len) => sum + len, 0);

        if (distAlongPath > total - 1) {// Pan directly to end of path
          const [transform] = state.getCenteredCssTransforms(path.slice(-1));
          return {
            keyframes: [{ offset: 0 }, { offset: 1, transform }],
            duration: initPanMs,
          };
        }

        let soFar = 0;
        /**
         * Index of path vertex whose outgoing edge first exceeds `distAlongPath`.
         * We'll remove this vertex and all preceding ones.
         */
        const cutVertexId = path.findIndex((p, i) => (soFar += elens[i + 1]) >= distAlongPath);
        /** Distance along cut vertex's outgoing edge that we'll pan to */
        const alongCutEdge = distAlongPath - (soFar - elens[cutVertexId + 1]);
        const panDst = (new Vect).copy(path[cutVertexId + 1]).sub(path[cutVertexId]).normalize(alongCutEdge).add(path[cutVertexId]);
        const subPath = [panDst].concat(path.slice(cutVertexId + 1));
        const subElens = [0, elens[cutVertexId + 1] - alongCutEdge].concat(elens.slice(cutVertexId + 2));
        /** Does not include distance of initial pan */
        const subTotal = total - distAlongPath;

        /** `initPanMs` for 1st edge, `subTotal * animScaleFactor` for rest */
        const duration = initPanMs + (subTotal * animScaleFactor);
        const ratio = 1 - (initPanMs / duration);
        const transforms = state.getCenteredCssTransforms(subPath);
        soFar = 0;

        return {
          duration,
          keyframes: [
            { offset: 0 },
            ...subElens.map((elen, i) => ({
              // ℹ️ final offset 0.9999 causes jerkiness
              offset: precision(
                (initPanMs / duration) + (ratio * ((soFar += elen) / subTotal))
              ),
              transform: transforms[i],
            }))
          ],
        };
      },
      delayIdle() {
        state.idleTimeoutId && window.clearTimeout(state.idleTimeoutId);
        state.idleTimeoutId = window.setTimeout(state.idleTimeout, state.opts.idleMs);
      },
      distanceTo(worldPosition) {
        return Vect.distanceBetween(worldPosition, state.getWorldAtCenter());
      },
      async followPath(path, { animScaleFactor }) {
        if (path.length === 0) {
          return;
        } else if (path.length === 1) {
          return await state.panZoomTo({ durationMs: 1000, worldPoint: path[0], id: 'followPath' });
        }

        await state.animationAction('cancel');
        await state.animationAction('cancelFollow');

        const { keyframes, duration } = state.computePathKeyframes(path, animScaleFactor);
        state.followAnim = state.followEl.animate(keyframes, {
          // ℹ️ Jerky on Safari Desktop and Firefox Mobile
          duration,
          direction: 'normal',
          fill: 'forwards',
          easing: 'linear',
          id: 'followPath',
        });

        await new Promise((resolve, reject) => {
          const anim = /** @type {Animation} */ (state.followAnim);
          anim.addEventListener('finish', () => {
            resolve('completed');
            state.releaseAnim(anim, state.followEl);
            state.syncStyles();
            state.followAnim === anim && (state.followAnim = null);
          });
          anim.addEventListener('cancel', () => reject('cancelled'));
        });
      },
      getCenteredCssTransforms(worldPoints) {
        const { width: screenWidth, height: screenHeight } = state.rootEl.getBoundingClientRect();
        return worldPoints.map(point => `translate(${
          screenWidth/2 + state.rootEl.scrollLeft - state.x - (state.scale * point.x)
        }px, ${
          screenHeight/2 + state.rootEl.scrollTop - state.y - (state.scale * point.y)
        }px)`);
      },
      getCurrentTransform() {
        const matrix = new DOMMatrix(getComputedStyle(state.panzoomEl).transform);
        return { x: matrix.e, y: matrix.f, scale: matrix.a };
      },
      getTrackingTranslate() {
        const matrix = new DOMMatrix(getComputedStyle(state.followEl).transform);
        return { x: matrix.e, y: matrix.f };
      },
      getWorld(e) {
        const parentBounds = state.rootEl.getBoundingClientRect();
        const { x: trackX, y: trackY } = state.getTrackingTranslate();
        const screenX = e.clientX - parentBounds.left - trackX;
        const screenY = e.clientY - parentBounds.top - trackY;
        const current = state.getCurrentTransform();
        // Need scroll offset to get actual current translation
        const worldX = (screenX - (current.x - state.rootEl.scrollLeft)) / current.scale;
        const worldY = (screenY - (current.y - state.rootEl.scrollTop)) / current.scale;
        return { x: worldX, y: worldY };
      },
      getWorldAtCenter() {
        const parentBounds = state.rootEl.getBoundingClientRect();
        const { x: trackX, y: trackY } = state.getTrackingTranslate();
        const current = state.getCurrentTransform();
        // Need scroll offset to get actual current translation
        const worldX = (parentBounds.width/2 - trackX - (current.x - state.rootEl.scrollLeft)) / current.scale;
        const worldY = (parentBounds.height/2 - trackY - (current.y - state.rootEl.scrollTop)) / current.scale;
        return { x: worldX, y: worldY };
      },
      idleTimeout() {
        if (state.pointers.length === 0) {
          state.idleTimeoutId = 0;
          state.events.next({ key: 'ui-idle' });
        } else {
          state.delayIdle();
        }
      },
      isFollowing() {
         return this.panzoomAnim?.id === 'followPath' && this.panzoomAnim.playState === 'running';
      },
      isIdle() {
        return state.idleTimeoutId === 0;
      },
      async panZoomTo(opts) {
        const {
          durationMs,
          scale = state.scale,
          worldPoint = state.getWorldAtCenter(),
          easing = 'ease',
          id = 'panZoomTo',
        } = opts;
        await state.animationAction('cancel');
        /**
         * Compute (x_i, y_i) s.t. `translate(x_i, y_i) scale(scale)` has `worldPoint` at screen center,
         * i.e. x_i + (scale * worldPoint.x_i) = screenWidth/2
         * i.e. x_i := screenWidth/2 - (scale * worldPoint.x_i)
         * For screen center also need to take account of scroll{Left,Top}.
         */
        const { width: screenWidth, height: screenHeight } = state.rootEl.getBoundingClientRect();
        const { x: trackX, y: trackY } = state.getTrackingTranslate();
        const dstX = screenWidth/2 + state.rootEl.scrollLeft - (scale * worldPoint.x) - trackX;
        const dstY = screenHeight/2 + state.rootEl.scrollTop - (scale * worldPoint.y) - trackY;

        const anim = state.panzoomAnim = state.panzoomEl.animate([
          { offset: 0 },
          { offset: 1, transform: `translate(${dstX}px, ${dstY}px) scale(${scale})` },
        ], {
          duration: durationMs,
          direction: 'normal',
          fill: 'forwards',
          easing,
          id,
        });
        
        try {
          state.events.next({ key: 'started-panzoom-to' });
          await anim.finished;
          this.panzoomAnim === anim && (this.panzoomAnim = null);
          state.events.next({ key: 'completed-panzoom-to' });
          state.releaseAnim(anim, state.panzoomEl);
        } catch (e) {
          this.panzoomAnim === anim && (this.panzoomAnim = null);
          state.events.next({ key: 'cancelled-panzoom-to' });
        } finally {
          state.syncStyles();
        }
      },
      releaseAnim(anim, parentEl) {
        if (isAnimAttached(anim, parentEl)) {
          anim.commitStyles();
        }
        anim.cancel();
      },
      rootRef(el) {
        if (el) {
          state.panzoomEl = el;
          state.followEl = /** @type {*} */ (el.parentElement);
          state.rootEl = /** @type {*} */ (state.followEl.parentElement);
        }
      },
      syncStyles() {
        Object.assign(state, state.getCurrentTransform());
        state.setStyles();
      },
      setStyles() {
        state.panzoomEl.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
      },
      zoomToClient(dstScale, e) {
        const parentBounds = state.rootEl.getBoundingClientRect();
        // 🤔 could force centred zoom if state.isFollowing()
        const { x: trackX, y: trackY } = state.getTrackingTranslate();
        const screenX = e.clientX - parentBounds.left - trackX;
        const screenY = e.clientY - parentBounds.top - trackY;
        // Compute world position given `translate(x, y) scale(scale)` (offset by scroll)
        // - world to screen is: state.x + (state.scale * worldX)
        // - screen to world is: (screenX - state.x) / state.scale
        const worldX = (screenX - (state.x - state.rootEl.scrollLeft)) / state.scale;
        const worldY = (screenY - (state.y - state.rootEl.scrollTop)) / state.scale;
        // To maintain position,
        // - need state.x' s.t. worldX' := (screenX - state.x') / toScale = worldPoint.x
        // - we undo scroll so that syncStyles makes sense
        state.x = screenX - (worldX * dstScale) + state.rootEl.scrollLeft;
        state.y = screenY - (worldY * dstScale) + state.rootEl.scrollTop;
        state.scale = dstScale;
        state.setStyles();
      },
      zoomWithWheel(event) {
        event.preventDefault(); // Avoid conflict with regular page scroll
        // Normalize to deltaX in case shift modifier is used on Mac
        const delta = event.deltaY === 0 && event.deltaX ? event.deltaX : event.deltaY;
        // Wheel has extra 0.5 scale factor (unlike pinch)
        const wheel = (delta < 0 ? 1 : -1) * 0.5;

        const dstScale = state.clampScale(
          state.scale * Math.exp((wheel * state.opts.step) / 3)
        );
        state.zoomToClient(dstScale, event);
      }
    };
  }, { deeper: ['evt'] });

  React.useLayoutEffect(() => {
    const pointerup = /** @param {PointerEvent} e */ e => state.evt.pointerup(e);
    const cb = {
      wheel: /** @param {WheelEvent} e */ e => state.evt.wheel(e),
      pointerdown: /** @param {PointerEvent} e */ e => state.evt.pointerdown(e),
      pointermove: /** @param {PointerEvent} e */ e => state.evt.pointermove(e),
      pointerup,
      pointerleave: pointerup,
      pointercancel: pointerup,
      // scroll: () => { console.log('devtool scroll!'); },
    };
    keys(cb).forEach(key => state.rootEl.addEventListener(key, /** @type {(e: Event) => void} */ (cb[key])));

    props.onLoad?.(state);

    // Apply initial zoom and centering
    const { init } = props;
    state.setStyles();
    state.panZoomTo({
      durationMs:  init?.ms ?? 1000,
      scale: init?.zoom ?? 1,
      worldPoint: { x: init?.x ?? 0, y: init?.y ?? 0 },
    })
      ?.catch(_x => {}); // ?

    return () => {
      keys(cb).forEach(key => state.rootEl.removeEventListener(key, /** @type {(e: Event) => void} */ (cb[key])));
    };
  }, []);

  const [measureRef, bounds] = useMeasure({ debounce: 30, scroll: false });
  
  React.useEffect(() => {
    if (bounds.width && bounds.height) {
      state.events.next({ key: 'resized-bounds', bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } });
    }
  }, [bounds.width, bounds.height]);

  return (
    <div
      className={cx("panzoom-root", rootCss, props.className)}
      data-meta={JSON.stringify({ 'world-root': true })}
      ref={measureRef}
      style={{ backgroundColor: props.background ?? '#fff' }}
    >
      <div className="follow">
        <div
          ref={state.rootRef}
          className="panzoom"
        >
          <div className="origin" />
          {props.children}
          {props.grid && <div className="small-grid" />}
          {props.grid && <div className="large-grid" />}
        </div>
      </div>
    </div>
  )
}

/** Must divide 60 */
const gridExtent = 60 * 60;
const gridColour = 'rgba(100, 100, 100, 0.1)';

const rootCss = css`
  width: 100%;
  height: 100%;
  /** Needed so .panzoom-root will scroll */
  overflow: hidden;
  user-select: none;
  /** This is important for mobile to prevent scrolling while panning */
  touch-action: none;
  cursor: auto;

  .follow {
    will-change: transform;
  }

  .panzoom {
    will-change: transform;
    user-select: none;
    touch-action: none;
    transform-origin: 0 0;

    .hide-grid {
      .small-grid, .large-grid {
        display: none;
      }
    }

    .small-grid, .large-grid {
      position: absolute;
      pointer-events: none;
      left: ${-gridExtent}px;
      top: ${-gridExtent}px;
      width: ${2 * gridExtent}px;
      height: ${2 * gridExtent}px;
    }
    .small-grid {
      background-image:
        linear-gradient(to right, ${gridColour} 1px, transparent 1px),
        linear-gradient(to bottom, ${gridColour} 1px, transparent 1px);
        background-size: 10px 10px;
      }
      .large-grid {
      background-image:
        linear-gradient(to right, ${gridColour} 1px, transparent 1px),
        linear-gradient(to bottom, ${gridColour} 1px, transparent 1px);
      background-size: 60px 60px;
    }
    .origin {
      position: absolute;
    }
  }
`;

/**
 * @typedef Props @type {object}
 * @property {string} [className]
 * @property {string} [background]
 * @property {boolean} [grid]
 * @property {{ x?: number; y?: number; ms?: number; zoom?: number }} [init]
 * @property {(api: PanZoom.CssApi) => void} [onLoad]
 */

/**
 * @param {PointerEvent[]} pointers 
 * @param {PointerEvent} event 
 */
function ensurePointer(pointers, event) {
  let i
  // Add touches if applicable -- why?
  if (/** @type{*} */ (event).touches) {
    i = 0
    for (const touch of /** @type{*} */ (event).touches) {
      touch.pointerId = i++
      ensurePointer(pointers, touch)
    }
    return;
  }
  i = pointers.findIndex(other => other.pointerId === event.pointerId);
  if (i > -1) pointers.splice(i, 1)

  pointers.push(event);
}

/**
 * This works whether there are multiple pointers or not
 * @param {PointerEvent[]} pointers 
 * @returns 
 */
function getMiddle(pointers) {
  // Copy to avoid changing by reference
  pointers = pointers.slice(0)
  let event1 = /** @type {Pick<PointerEvent, 'clientX' | 'clientY'>} */ (pointers.pop())
  let event2;
  while ((event2 = pointers.pop())) {
    event1 = {
      clientX: (event2.clientX - event1.clientX) / 2 + event1.clientX,
      clientY: (event2.clientY - event1.clientY) / 2 + event1.clientY
    }
  }
  return event1
}

/**
 * @param {PointerEvent[]} pointers 
 */
function getDistance(pointers) {
  if (pointers.length < 2) {
    return 0
  }
  const event1 = pointers[0]
  const event2 = pointers[1]
  return Math.sqrt(
    Math.pow(Math.abs(event2.clientX - event1.clientX), 2) +
      Math.pow(Math.abs(event2.clientY - event1.clientY), 2)
  )
}

/**
 * 
 * @param {PointerEvent[]} pointers 
 * @param {PointerEvent} event 
 */
function removePointer(pointers, event) {
  // Add touches if applicable
  if (/** @type {*} */  (event).touches) {
    // Remove all touches
    while (pointers.length) {
      pointers.pop()
    }
    return
  }
  const i = pointers.findIndex(other => other.pointerId === event.pointerId);
  if (i > -1) {
    pointers.splice(i, 1)
  }
}
