import React from "react";
import { css } from "@emotion/css";

import * as defaults from "./defaults";
import { geomorphPngPath } from "../service/geomorph";
import { Rect } from "../geom";
import SvgPanZoom from "../panzoom/SvgPanZoom";
import useGeomorphData from "../geomorph/use-geomorph-data";
import usePathfinding from "../geomorph/use-pathfinding";
import { svgNavGraph } from "./jsx-dom";

/** @param {{ layoutKey: Geomorph.LayoutKey; disabled?: boolean; }} props */
export default function SvgNavGraph(props) {

  const { data: gm } = useGeomorphData(props.layoutKey);
  const { data: pf } = usePathfinding(props.layoutKey, gm, props.disabled);

  /** @type {React.RefObject<SVGGElement>} */
  const groupRef = React.useRef(null);

  React.useEffect(() => {
    const g = groupRef.current;
    if (!props.disabled && pf && g) {
      /**
       * We do direct DOM manipulation,
       * because React was incredibly slow.
       */
      svgNavGraph(g, pf.graph);
      return () => Array.from(g.children).forEach(x => x.remove());
    }
  }, [props.disabled, pf]);

  return (
    <SvgPanZoom
      gridBounds={defaults.gridBounds}
      initViewBox={initViewBox}
      maxZoom={6}
      className={rootCss}
      dark
    >
      {gm && <image {...gm.pngRect} className="geomorph" href={geomorphPngPath(props.layoutKey)} />}

      <g ref={groupRef} />

    </SvgPanZoom>
  );
}

const rootCss = css`
  image.geomorph {
    /* filter: invert(); */
  }
  circle.node {
    fill: #ff000068;
    /* pointer-events: none; */
  }
  path.edge, line.edge {
    stroke: #900;
    stroke-width: 1;
    pointer-events: none;
  }

  polygon.navtri {
    fill: transparent;
    transition: fill 0.3s;
    &:hover, &:active, &:focus {
      fill: #8080ff37;
      stroke: rgba(0, 0, 255, 0.3);
    }
  }  
`;

const initViewBox = new Rect(0, 0, 600, 600);
