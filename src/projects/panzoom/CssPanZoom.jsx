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
import { isAnimAttached } from "../service/dom";
import useStateRef from "../hooks/use-state-ref";

/** @param {React.PropsWithChildren<Props>} props */
export default function CssPanZoom(props) {

  const state = useStateRef(/** @type {() => PanZoom.CssApi} */ () => {
    return {
      ready: true,
      opts: { minScale: 0.05, maxScale: 10, step: 0.05, idleMs: 200 },

      rootEl: /** @type {HTMLDivElement} */ ({}),
      cenZoomEl: /** @type {HTMLDivElement} */ ({}),
      panZoomEl: /** @type {HTMLDivElement} */ ({}),

      panZoomAnim: null,

      cenScale: 1,
      x: 0,
      y: 0,
      scale: 1,
      
      panning: false,
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
          !state.isFollowing() && state.animationAction('cancel');
          state.zoomWithWheel(e);
        },
        pointerdown(e) {
          state.delayIdle();
          ensurePointer(state.pointers, e);
          !state.isFollowing() && state.animationAction('cancel');

          state.panning = true;
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

          if (state.isFollowing()) {
            // 🚧 breaks "door open whilst walking" (drag click)
            state.start.clientX = state.start.clientY = undefined;
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
            // Use the distance between the first 2 pointers
            // to determine the current scale
            const diff = getDistance(state.pointers) - state.start.distance
            const step = 3 * state.opts.step;
            const currScale = state.isFollowing() ? state.cenScale : state.scale;
            const dstScale = Math.min(Math.max(((diff * step) / 80 + currScale), state.opts.minScale), state.opts.maxScale);
            state.zoomToClient(dstScale, current);
          } else {
            // Panning during pinch zoom can cause issues
            // because the zoom has not always rendered in time
            // for accurate calculations
            // See https://github.com/timmywil/panzoom/issues/512
            // 🚧 clarify
            const nextX = state.origin.x + (current.clientX - state.start.clientX) / state.cenScale;
            const nextY = state.origin.y + (current.clientY - state.start.clientY) / state.cenScale;

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
          if (!state.panning) {
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
            longClick: (Date.now() - state.start.epochMs) >= 500,
            distance,
          };

          state.events.next({
            key: 'pointerup',
            point: worldPointerUp,
            meta,
            clickId: state.clickIds.pop(),
          });

          state.panning = false;
          state.origin = state.start.clientX = state.start.clientY = undefined;
          // state.clearTransition();
        },
      },

      async animationAction(type) {
        const anim = state.panZoomAnim;
        if (!anim) {
          return;
        }
        switch (type) {
          case 'cancel': {
            state.syncStyles(); // Remember current translate/scale
            isAnimAttached(anim, state.panZoomEl) && await new Promise(resolve => {
              anim.addEventListener('cancel', resolve)
              anim.cancel();
            });
            state.panZoomAnim = null;
            break;
          }
          case 'pause': // Avoid pausing finished animation
            state.panZoomAnim?.playState === 'running' && state.panZoomAnim.pause();
            break;
          case 'play':
            state.panZoomAnim?.playState === 'paused' && state.panZoomAnim.play();
            break;
          default:
            throw testNever(type, { suffix: 'animationAction' });
        }
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
        return worldPosition.distanceTo(state.getWorldAtCenter());
      },
      async followPath(path, { animScaleFactor }) {
        if (path.length === 0) {
          return;
        } else if (path.length === 1) {
          return await state.panZoomTo(undefined, path[0], 1000, undefined, 'followPath');
        }

        await state.animationAction('cancel');
        const { keyframes, duration } = state.computePathKeyframes(path, animScaleFactor);
        state.panZoomAnim = state.panZoomEl.animate(keyframes, {
          // ℹ️ Jerky on Safari Desktop and Firefox Mobile
          duration,
          direction: 'normal',
          fill: 'forwards',
          easing: 'linear',
          id: 'followPath',
        });

        await new Promise((resolve, reject) => {
          const anim = /** @type {Animation} */ (state.panZoomAnim);
          anim.addEventListener('finish', () => {
            resolve('completed');
            state.releaseAnim(anim, state.panZoomEl);
            state.syncStyles();
          });
          anim.addEventListener('cancel', () => reject('cancelled'));
        });
      },
      getCenteredCssTransforms(worldPoints) {
        const { width: screenWidth, height: screenHeight } = state.rootEl.getBoundingClientRect();
        return worldPoints.map(point => `translate(${
          screenWidth/2 + state.rootEl.scrollLeft - (state.scale * point.x)}px, ${
          screenHeight/2 + state.rootEl.scrollTop - (state.scale * point.y)}px) scale(${state.scale})`
        );
      },
      getCurrentTransform() {
        const matrix = new DOMMatrix(getComputedStyle(state.panZoomEl).transform);
        return { x: matrix.e, y: matrix.f, scale: matrix.a };
      },
      getWorld(e) {
        const parentBounds = state.rootEl.getBoundingClientRect();
        let screenX = e.clientX - parentBounds.left;
        let screenY = e.clientY - parentBounds.top;
        // 🚧 clarify
        screenX = (screenX - parentBounds.width/2) / this.cenScale + parentBounds.width/2;
        screenY = (screenY - parentBounds.height/2) / this.cenScale + parentBounds.height/2;
        const current = state.getCurrentTransform();
        // Need scroll offset to get actual current translation
        const worldX = (screenX - (current.x - state.rootEl.scrollLeft)) / current.scale;
        const worldY = (screenY - (current.y - state.rootEl.scrollTop)) / current.scale;
        return { x: worldX, y: worldY };
      },
      getWorldAtCenter() {
        const parentBounds = state.rootEl.getBoundingClientRect();
        const current = state.getCurrentTransform();
        // Need scroll offset to get actual current translation
        const worldX = (parentBounds.width/2 - (current.x - state.rootEl.scrollLeft)) / current.scale;
        const worldY = (parentBounds.height/2 - (current.y - state.rootEl.scrollTop)) / current.scale;
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
         return this.panZoomAnim?.id === 'followPath';
      },
      isIdle() {
        return state.idleTimeoutId === 0;
      },
      async panZoomTo(
        scale = state.scale,
        worldPoint = state.getWorldAtCenter(),
        durationMs,
        easing = 'ease',
        id = 'panZoomTo',
      ) {
        await state.animationAction('cancel');
        /**
         * Compute (x, y) s.t. `translate(x_1, y_2) scale(scale)` has `worldPoint` at screen center,
         * i.e. x_i + (scale * worldPoint.x_i) = screenWidth/2
         * i.e. x_i := screenWidth/2 - (scale * worldPoint.x_i)
         * For screen center also need to take account of scroll{Left,Top}.
         */
        const { width: screenWidth, height: screenHeight } = state.rootEl.getBoundingClientRect();
        const dstX = screenWidth/2 + state.rootEl.scrollLeft - (scale * worldPoint.x);
        const dstY = screenHeight/2 + state.rootEl.scrollTop - (scale * worldPoint.y);

        state.panZoomAnim = state.panZoomEl.animate([
          { offset: 0 },
          { offset: 1, transform: `translate(${dstX}px, ${dstY}px) scale(${scale})` },
        ], {
          duration: durationMs,
          direction: 'normal',
          fill: 'forwards',
          easing,
          id,
        });

        state.events.next({ key: 'started-panzoom-to' });
        state.panZoomEl.classList.add('hide-grid'); // Avoid Chrome flicker

        let finished = false;
        await new Promise((resolve, reject) => {
          const anim = /** @type {Animation} */ (state.panZoomAnim);
          anim.addEventListener('finish', () => {
            finished = true;
            resolve('completed');
            state.events.next({ key: 'completed-panzoom-to' });
            // Release animation e.g. so can manually alter styles
            state.releaseAnim(anim, state.panZoomEl);
            state.syncStyles();
          });
          anim.addEventListener('cancel', async () => {
            reject('cancelled');
            !finished && state.events.next({ key: 'cancelled-panzoom-to' });
            state.panZoomEl.classList.remove('hide-grid');
            state.syncStyles();
          });
        });
      },
      releaseAnim(anim, parentEl) {
        if (isAnimAttached(anim, parentEl)) {
          anim.commitStyles();
        }
        anim.cancel();
      },
      rootRef(el) {
        if (el) {
          state.cenZoomEl = /** @type {*} */ (el.parentElement);
          state.rootEl = /** @type {*} */ (state.cenZoomEl.parentElement);
          state.panZoomEl = el;
        }
      },
      syncStyles() {
        Object.assign(state, state.getCurrentTransform());
        state.setStyles();
      },
      setStyles() {
        state.panZoomEl.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
        state.cenZoomEl.style.transform = `scale(${state.cenScale})`;
      },
      zoomToClient(dstScale, e) {
        if (state.isFollowing()) {
          state.cenScale = dstScale;
        } else {
          const parentBounds = state.rootEl.getBoundingClientRect();
          let screenX = e.clientX - parentBounds.left;
          let screenY = e.clientY - parentBounds.top;
          // 🚧 clarify
          screenX = (screenX - parentBounds.width/2) / this.cenScale + parentBounds.width/2;
          screenY = (screenY - parentBounds.height/2) / this.cenScale + parentBounds.height/2;
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
        }
        state.setStyles();
      },
      zoomWithWheel(event) {
        event.preventDefault(); // Avoid conflict with regular page scroll
        // Normalize to deltaX in case shift modifier is used on Mac
        const delta = event.deltaY === 0 && event.deltaX ? event.deltaX : event.deltaY;
        // Wheel has extra 0.5 scale factor (unlike pinch)
        const wheel = (delta < 0 ? 1 : -1) * 0.5;

        const currScale = state.isFollowing() ? state.cenScale : state.scale;
        const dstScale = Math.min(
          Math.max(currScale * Math.exp((wheel * state.opts.step) / 3), state.opts.minScale),
          state.opts.maxScale,
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
    state.panZoomTo(init?.zoom ?? 1, { x: init?.x ?? 0, y: init?.y ?? 0 }, init?.ms ?? 1000)
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
      style={{ backgroundColor: props.background || '#fff' }}
    >
      <div className="centered-zoom">
        <div
          ref={state.rootRef}
          className="panzoom-transform"
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
  
  .centered-zoom {
    transform-origin: 50% 50%;
    width: 100%;
    height: 100%;
  }

  .panzoom-transform {
    width: 0;
    height: 0;
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
