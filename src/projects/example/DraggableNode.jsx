import React from "react";
import { css, cx } from "@emotion/css";
import { Vect } from "../geom";
import { getSvgPos } from "../service/dom";
import useUpdate from '../hooks/use-update';

/** @param {DraggableNodeProps} props */
export default function DraggableNode(props) {

  const update = useUpdate();

  const [state] = React.useState(() => {
    const output = {
      position: Vect.from(props.initial),
      target: Vect.from(props.initial),
      dragging: false,

      
      rootEl: /** @type {SVGGElement} */ ({}),
      lineEl: /** @type {SVGLineElement} */ ({}),
      circleEl: /** @type {SVGCircleElement} */ ({}),

      /** @type {React.RefCallback<SVGGElement>} */
      rootRef: (el) => {
        if (el) {
          state.rootEl = el;
          state.lineEl = /** @type {SVGLineElement} */ (el.querySelector('line.drag-indicator'));
          state.circleEl = /** @type {SVGCircleElement} */ (el.querySelector('circle.node'));
          state.circleEl.addEventListener('pointerdown', state.startDrag);
          state.circleEl.addEventListener('pointerup', state.applyDrag);
        }
      },
      /** @param {PointerEvent} e */
      startDrag: (e) => {
        /**
         * TODO prevent drag if PanZoom has pointerids
         * TODO lock/unlock PanZoom on drag begin/end
         */
        e.stopPropagation();
        state.dragging = true;
        state.lineEl.style.display = 'inline';
        state.target.copy(state.position);
        ['x1', 'x2'].forEach(attr => state.lineEl.setAttribute(attr, String(state.position.x)));
        ['y1', 'y2'].forEach(attr => state.lineEl.setAttribute(attr, String(state.position.y)));
        const svg = /** @type {SVGSVGElement} */ (state.lineEl.ownerSVGElement);
        svg.addEventListener('pointermove', state.onMove);
        svg.addEventListener('pointerleave', state.endDrag);
        svg.addEventListener('pointerup', state.applyDrag);
        window.addEventListener('keydown', state.endDragOnEscape);
        svg.style.cursor = 'grabbing';
        props.onStart?.();
      },
      /** @param {PointerEvent}  e */
      onMove: (e) => {
        e.stopPropagation();
        if (state.dragging) {
          const { x, y } = getSvgPos({
            clientX: e.clientX,
            clientY: e.clientY,
            ownerSvg: /** @type {SVGSVGElement} */ (state.lineEl.ownerSVGElement),
            pointerId: null,
          });
          const target = new Vect(x, y);
          if (state.position.distanceTo(target) >= 20) {
            state.target.set(x, y);
            state.lineEl.setAttribute('x2', String(x));
            state.lineEl.setAttribute('y2', String(y));
          }
        }
      },
      endDrag: () => {
        if (!state.dragging) return;
        state.dragging = false; // Mutate
        state.lineEl.style.display = 'none';
        state.lineEl.setAttribute('x2', /** @type {*} */ (state.lineEl.getAttribute('x1')));
        state.lineEl.setAttribute('y2', /** @type {*} */ (state.lineEl.getAttribute('y1')));
        const svg = /** @type {SVGSVGElement} */ (state.lineEl.ownerSVGElement);
        svg.removeEventListener('pointermove', state.onMove);
        svg.removeEventListener('pointerleave', state.endDrag);
        svg.removeEventListener('pointerup', state.applyDrag);
        window.removeEventListener('keydown', state.endDragOnEscape);
        svg.style.cursor = 'auto';
      },
      applyDrag: () => {
        if (!state.dragging) return;
        state.endDrag();

        if (props.shouldCancel?.(state.position.clone(), state.target.clone())) {
          // console.log('drag cancelled');
          return;
        }
        if (state.target.distanceTo(state.position) < 20) {// Click 
          // console.log('click')
          props.onClick?.(state.position.clone());
        } else {// Drag
          // console.log('drag')
          state.moveTo(state.target);
          props.onStop?.(state.target.clone());
        }
      },
      /** @param {KeyboardEvent} e */
      endDragOnEscape: (e) => void (e.key === 'Escape' && state.endDrag()),
      /** @param {Geom.VectJson} p */
      moveTo: (p) => {
        state.position.copy(p);
        state.lineEl.setAttribute('x1', String(state.target.x));
        state.lineEl.setAttribute('y1', String(state.target.y));
        update();
      },
    };
    props.onLoad?.({
      moveTo: output.moveTo,
      getPosition: () => state.position.clone(),
    });
    return output;
  });

  const radius = props.radius || 16;

  return (
    <g className={rootCss} ref={state.rootRef}>
      {props.icon && (
        {
          run: (
            <image
              className="icon"
              href="/assets/icon/running.svg"
              width="20" height="20" x={state.position.x - 10} y={state.position.y - 10} 
            />
            ),
          finish: (
            <image
              className="icon"
              href="/assets/icon/target.svg"
              width="20" height="20" x={state.position.x - 10} y={state.position.y - 10} 
            />
          ),
        }[props.icon]
      ) || (
        <circle
          className="inner-node"
          cx={state.position.x}
          cy={state.position.y}
          r={4}
        />
      )}
      <circle
        className="node"
        cx={state.position.x}
        cy={state.position.y}
        r={radius}
      />
      <line
        className="drag-indicator"
        stroke={props.stroke || 'blue'}
      />
    </g>
  );
}

const rootCss = css`
  circle.node {
    fill: rgba(0, 0, 100, 0.1);
    stroke: rgba(0, 0, 100, 0.2);
    stroke-dasharray: 4px 4px;
    cursor: pointer;
  }
  circle.inner-node {
    stroke: black;
    cursor: pointer;
    stroke-width: 0.5;
  }
  line.drag-indicator {
    display: none;
    stroke-width: 2.5;
    user-select: none;
    pointer-events: none;
  }
`;

/**
 * @typedef DraggableNodeProps @type {object}
 * @property {Geom.VectJson} initial
 * @property {number} [radius]
 * @property {'run' | 'finish'} [icon]
 * @property {string} [stroke]
 * @property {(api: DraggableNodeApi) => void} [onLoad]
 * @property {() => void} [onStart]
 * @property {(position: Geom.Vect) => void} [onStop]
 * @property {(position: Geom.Vect) => void} [onClick]
 * @property {(current: Geom.Vect, next: Geom.Vect) => void} [shouldCancel]
 */

/**
 * @typedef DraggableNodeApi @type {object}
 * @property {(p: Geom.VectJson) => void} moveTo
 * @property {() => Geom.Vect} getPosition
 */
