/**
 * This component is used to build a geomorph step-by-step.
 * We compute the actual layout (as opposed to loading JSON).
 */
import * as React from "react";
import { css, cx } from "@emotion/css";
import { useQuery } from "react-query";

import { hashText } from "../service/generic";
import { loadImage } from "../service/dom";
import { geom } from "../service/geom";
import { labelMeta, singlesToPolys } from "../service/geomorph";
import { createLayout, deserializeSvgJson } from "../service/geomorph";
import layoutDefs from "../geomorph/geomorph-layouts";
import { renderGeomorph } from "../geomorph/render-geomorph";
import * as defaults from "../example/defaults";
import svgJson from '../../../public/symbol/svg.json'; // CodeSandbox?
import PanZoom from '../panzoom/PanZoom';

const scale = 2;

/** @param {{ disabled?: boolean }} props */
export default function GeomorphEdit({ disabled }) {
  return (
    <div className={rootCss}>
      <PanZoom initViewBox={defaults.initViewBox} gridBounds={defaults.gridBounds} maxZoom={6}>
        {/* <Geomorph def={layoutDefs["g-101--multipurpose"]} /> */}
        {/* <Geomorph def={layoutDefs["g-102--research-deck"]} /> */}
        {/* <Geomorph def={layoutDefs["g-301--bridge"]} /> */}
        <Geomorph def={layoutDefs["g-302--xboat-repair-bay"]} />
        {/* <Geomorph def={layoutDefs["g-301--bridge"]} transform="matrix(1,0,0,1,-1200,0)" /> */}
        {/* <Geomorph def={layoutDefs["g-303--passenger-deck"]} disabled={disabled} /> */}
      </PanZoom>
    </div>
  );
}

/** @param {{ def: Geomorph.LayoutDef; transform?: string; disabled?: boolean }} _ */
function Geomorph({ def, transform, disabled }) {

  const hash = React.useMemo(() => hashText(JSON.stringify(def)), [def]);

  const { data: gm, error } = useQuery(
    `GeomorphEdit--${def.key}--${hash}`,
    async () => computeLayout(def),
    {
      keepPreviousData: true,
      enabled: !disabled,
    },
  );

  return gm ? (
    <g className={cx("geomorph", def.key)} transform={transform}>
      <image className="geomorph" href={gm.dataUrl} x={gm.pngRect.x * scale} y={gm.pngRect.y * scale} />
      <ForeignObject gm={gm} />
      <image className="debug" href={gm.pngHref} x={gm.pngRect.x} y={gm.pngRect.y}/>
    </g>
  ) : null;
}

/** @param {{ gm: Geomorph.BrowserLayout }} props */
function ForeignObject({ gm }) {

  /** @param {React.MouseEvent<HTMLElement>} e */
  const onClick = (e) => {
    const div = /** @type {HTMLDivElement} */ (e.target);
    console.log('you clicked', div);
  };

  return (
    <foreignObject {...gm.pngRect} xmlns="http://www.w3.org/1999/xhtml">
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
      </div>
    </foreignObject>
  );
}

/**
 * @param {Geomorph.LayoutDef} def
 * @returns {Promise<Geomorph.BrowserLayout>}
 */
async function computeLayout(def) {
  const symbolLookup = deserializeSvgJson(/** @type {*} */ (svgJson));
  const layout = await createLayout(def, symbolLookup);
  const canvas = document.createElement('canvas');

  await renderGeomorph(
    layout, symbolLookup, canvas, (pngHref) => loadImage(pngHref),
    { scale, navTris: false },
  );

  return {
    dataUrl: canvas.toDataURL(),
    /** Unscaled */
    pngRect: layout.items[0].pngRect,
    doors: singlesToPolys(layout.groups.singles, 'door')
      .map(poly => geom.polyToAngledRect(poly)),
    /** Debug only */
    pngHref: layout.items[0].pngHref,
    labels: layout.labels,
  };
}

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
      background: white;
      border: 1px solid black;
    }
    circle {
      fill: red;
    }
  }
`;
