import React from "react";
import { css, cx } from "@emotion/css";
import { debounce } from "debounce";

import { Rect } from "../geom";
import { assertNonNull } from "../service/generic";
import { cssTransformToPoint } from "../service/dom";
import useUpdate from "../hooks/use-update";

/**
 * Path whose nodes positions are editable via chrome devtool
 * We'll detect, mutate props (i.e. decor def), and re-render
 * @param {PathProps} props 
 */
 export default function Path(props) {

    // 🚧 avoid needless ancestral re-renders
  
    /** @type {React.Ref<HTMLDivElement>} */
    const rootRef = React.useRef(null);
    const aabb = Rect.fromPoints(...props.decor.path);
    const update = useUpdate();
  
    React.useEffect(() => {
      const rootEl = assertNonNull(rootRef.current);
      const observer = new MutationObserver(debounce((records) => {
        // console.log({records});
  
        if (records.some(x => x.target instanceof HTMLDivElement && x.target.classList.contains('debug-point'))) {
          // Fired via chrome devtool, or `npc decor` re-render
          /**
           * Fired by:
           * (a) debug-point mutation via Chrome devtool
           * (b) re-render e.g. via `npc decor`
           * We now mutate props.decor using current value of DOM
           */
          const nodes = /** @type {HTMLDivElement[]} */ (Array.from(rootEl.querySelectorAll('div.debug-point')));
          const points = nodes.map(x => cssTransformToPoint(x));
          props.decor.path.length = 0;
          Array.from(points).forEach(p => props.decor.path.push(p));
          update();
        }
      }, 300));
      observer.observe(rootEl, { attributes: true, attributeFilter: ['style'], subtree: true });
  
      return () => observer.disconnect();
    }, []);
    
  
    return (
      <div
        ref={rootRef}
        className={cx('debug-path', cssPath)}
      >
        {props.decor.path.map((p, i) =>
          <div
            key={i}
            className="debug-point"
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          />
        )}
        {/* 🤔 image instead? */}
        <svg
          width={aabb.width}
          height={aabb.height}
          style={{ transform: `translate(${aabb.x}px, ${aabb.y}px)` }}
        >
          <g style={{ transform: `translate(${-aabb.x}px, ${-aabb.y}px)` }}>
            <polyline
              fill="none" stroke="#88f" strokeDasharray="2 2" strokeWidth={1}
              points={props.decor.path.map(p => `${p.x},${p.y}`).join(' ')}
            />
          </g>
        </svg>
      </div>
    );
  }
  
  /**
   * @typedef PathProps
   * @property {Extract<NPC.DecorDef, { type: 'path' }>} decor
   */
  
   const cssPath = css`
    .debug-point {
      position: absolute;
      left: -2px;
      top: -2px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      border: 1px solid #ff000088;
    }
   `;
  