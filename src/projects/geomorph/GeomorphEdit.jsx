/**
 * This component is used to build a geomorph step-by-step.
 * We compute the actual layout (as opposed to loading JSON).
 */
import * as React from "react";
import { css, cx } from "@emotion/css";
import { useQuery } from "react-query";

import { assertNonNull, hashText } from "../service/generic";
import { loadImage } from "../service/dom";
import { labelMeta } from "../service/geomorph";
import { deserializeSvgJson } from "../service/geomorph";
import layoutDefs from "../geomorph/geomorph-layouts";
import { renderGeomorph } from "../geomorph/render-geomorph";
import * as defaults from "../example/defaults";
import svgJson from '../../../static/assets/symbol/svg.json'; // CodeSandbox?
import SvgPanZoom from '../panzoom/SvgPanZoom';
import { createGeomorphData } from "./use-geomorph-data";

/** @param {{ disabled?: boolean }} props */
export default function GeomorphEdit({ disabled }) {
  return (
    <div className={rootCss}>
      <SvgPanZoom initViewBox={defaults.initViewBox} gridBounds={defaults.gridBounds} maxZoom={6}>
        {/* <Geomorph def={layoutDefs["g-101--multipurpose"]} /> */}
        {/* <Geomorph def={layoutDefs["g-102--research-deck"]} /> */}
        <Geomorph def={layoutDefs["g-301--bridge"]} />
        {/* <Geomorph def={layoutDefs["g-302--xboat-repair-bay"]} /> */}
        {/* <Geomorph def={layoutDefs["g-303--passenger-deck"]} disabled={disabled} /> */}
        {/* <Geomorph def={layoutDefs["g-301--bridge"]} transform="matrix(1,0,0,1,-1200,0)" /> */}
      </SvgPanZoom>
    </div>
  );
}

/** @param {{ def: Geomorph.LayoutDef; transform?: string; disabled?: boolean }} _ */
function Geomorph({ def, transform, disabled }) {

  const hash = React.useMemo(() => hashText(JSON.stringify(def)), [def]);

  const { data: gm, error } = useQuery(
    `GeomorphEdit--${def.key}--${hash}`,
    () => createGeomorphData(def.key),
      {
      keepPreviousData: true,
      enabled: !disabled,
    },
  );

  return gm ? (
    <g className={cx("geomorph", def.key)} transform={transform}>
      <ForeignObject gm={gm} />
      <image className="debug" href={gm.items[0].pngHref} x={gm.pngRect.x} y={gm.pngRect.y}/>
    </g>
  ) : null;
}

/** @param {{ gm: Geomorph.GeomorphData }} props */
function ForeignObject({ gm }) {

  /** @type {React.Ref<HTMLCanvasElement>} */
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const symbolLookup = deserializeSvgJson(/** @type {*} */ (svgJson));
    renderGeomorph(
      gm, symbolLookup, assertNonNull(canvasRef.current), (pngHref) => loadImage(pngHref),
      { scale: 1, navTris: false },
    );
  }, [gm]); // Redraw on HMR/def

  /** @param {React.MouseEvent<HTMLElement>} e */
  const onClick = (e) => {
    const div = /** @type {HTMLDivElement} */ (e.target);
    console.log('you clicked', div);
  };

  return (
    <foreignObject {...gm.pngRect} xmlns="http://www.w3.org/1999/xhtml">
      <canvas
        ref={canvasRef}
        className="geomorph"
        width={gm.pngRect.width}
        height={gm.pngRect.height}
      />
      <div onClick={onClick}>
        {gm.doors.map(({ baseRect, angle }, doorId) =>
          <div
            key={doorId}
            className="door"
            style={{
              left: baseRect.x - gm.pngRect.x,
              top: baseRect.y - gm.pngRect.y,
              width: baseRect.width,
              height: baseRect.height,
              transformOrigin: 'top left',
              transform: `rotate(${angle}rad)`,
            }} />
        )}
        {gm.labels.map(({ text, padded }, labelId) => (
          <div
            key={labelId}
            className="label"
            style={{
              left: padded.x - gm.pngRect.x,
              top: padded.y - gm.pngRect.y,
            }}
          >
            {text}
          </div>
        ))}
        {
          // 🚧 show view positions
          // 🚧 show view polys
        }
      </div>
    </foreignObject>
  );
}

const scale = 2;

const rootCss = css`
  background-color: #444;
  height: 100%;
  g > image.debug {
    opacity: 0.2;
  }
  g > image.geomorph {
    transform: scale(${1 / scale});
    pointer-events: none;
  }
  g > .doors rect {
    fill: white;
    stroke: black;
  }

  g > foreignObject {
    font: ${labelMeta.font};

    .geomorph {
      position: absolute;
    }

    div.label {
      position: absolute;
      padding: ${labelMeta.padY}px ${labelMeta.padX}px;
      
      cursor: pointer;
      pointer-events: auto;
      user-select: none; /** TODO better way? */

      background: black;
      color: white;
    }
    div.door {
      position: absolute;
      cursor: pointer;
      background: green;
      border: 1px solid black;
    }
    circle {
      fill: red;
    }
  }
`;
