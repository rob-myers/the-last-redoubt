import React from "react";
import { css, cx } from "@emotion/css";

import * as defaults from "./defaults";
import { Rect, Vect } from "../geom";
import { geomorphPngPath } from "../service/geomorph";
import { svgStringPull } from "./jsx-dom";

import useGeomorphData from "../geomorph/use-geomorph-data";
import usePathfinding from "../geomorph/use-pathfinding";
import useStateRef from "../hooks/use-state-ref";
import SvgPanZoom from "../panzoom/SvgPanZoom";
import DraggableNode from "./DraggableNode";

/** @param {{ disabled?: boolean }} props */
export default function SvgStringPull(props) {

  /** @type {Geomorph.LayoutKey} */
  const layoutKey = 'g-301--bridge';
  const zoneKey = layoutKey;
  const { data: gm } = useGeomorphData(layoutKey);
  const { data: pf } = usePathfinding(zoneKey, gm, props.disabled);

  const state = useStateRef(() => ({
    rootEl: /** @type {SVGGElement} */ ({}),
    pathEl: /** @type {null | SVGPolylineElement} */ (null),

    source: new Vect(300, 300),
    target: new Vect(600, 300),
    path: /** @type {Vect[]} */ ([]),

    updatePath: () => {
      if (pf) {
        const result = pf.graph.findPath(state.source, state.target);
        state.path = result ? result.fullPath : [state.source];
        state.pathEl = state.pathEl || state.rootEl.querySelector('polyline.navpath');
        state.pathEl?.setAttribute('points', `${state.path}`);
      }
    },
  }), { deps: [pf] });

  React.useEffect(() => {
    const g = /** @type {SVGGElement} */ (state.rootEl.querySelector('g.navtris'));
    if (!props.disabled && pf && g) {
      /**
       * We do direct DOM manipulation,
       * because React can be incredibly slow in older browsers.
       */
       svgStringPull(g, pf.graph);
      return () => Array.from(g.children).forEach(x => x.remove());
    }
  }, [props.disabled, pf]);

  return (
    <SvgPanZoom
      dark
      gridBounds={defaults.gridBounds}
      initViewBox={defaults.initViewBox}
      maxZoom={6}
    >
      <g
        className={cx(rootCss, !props.disabled && animateNavpathCss)}
        ref={(el) => {
          if (el) {
            state.rootEl = el;
            state.updatePath();
          }
        }}
      >
        {gm && <image {...gm.pngRect} className="geomorph" href={geomorphPngPath(layoutKey)} />}

        {/* {!props.disabled && pf?.graph.nodesArray.map(({ vertexIds }, nodeId) =>
          <polygon
            key={nodeId}
            className="navtri"
            points={`${vertexIds.map(id => pf.graph.vectors[id])}`}
          />
        )} */}

        <g className="navtris" />

        {gm && <>
          <DraggableNode
            initial={state.source}
            icon="run"
            onStop={(p) => {
              if (!gm.navPoly.some(x => x.contains(p))) return 'cancel';
              state.source.copy(p);
              state.updatePath();
            }}
          />

          <polyline className="navpath" points={`${state.path}`}/>

          <DraggableNode
            initial={state.target}
            icon="finish"
            onStop={(p) => {
              if (!gm.navPoly.some(x => x.contains(p))) return 'cancel';
              state.target.copy(p);
              state.updatePath();
            }}
          />
        </>}
      </g>

    </SvgPanZoom>
  );
}

const rootCss = css`
  border: 1px solid #555555;
  height: inherit;

  /* image.geomorph, image.icon {
    filter: invert(100%);
  } */

  polyline.navpath {
    fill: none;
    stroke: #083;
    stroke-width: 2;
    stroke-dasharray: 8px;
    stroke-dashoffset: 16px;
  }

  @keyframes stringPullFlash {
    0% { stroke-dashoffset: 16px; }
    100% { stroke-dashoffset: 0px; }
  }

  polygon.navtri {
    fill: transparent;
    &:hover {
      stroke: red;
    }
  }
`;

const animateNavpathCss = css`
  polyline.navpath {
    animation: 600ms stringPullFlash infinite linear;
  }
`;
