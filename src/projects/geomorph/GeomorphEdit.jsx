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
import useGeomorphs from "./use-geomorphs";

/** @type {Geomorph.LayoutKey} */
const layoutKey = 'g-301--bridge';

/** @param {{ disabled?: boolean }} props */
export default function GeomorphEdit({ disabled }) {
  return (
    <div className={rootCss}>
      <SvgPanZoom initViewBox={defaults.initViewBox} gridBounds={defaults.gridBounds} maxZoom={6}>
        <Geomorph def={layoutDefs[layoutKey]} />
        {/* <Geomorph def={layoutDefs["g-301--bridge"]} transform="matrix(1,0,0,1,-1200,0)" /> */}
      </SvgPanZoom>
    </div>
  );
}

/** @param {{ def: Geomorph.LayoutDef; transform?: string; disabled?: boolean }} _ */
function Geomorph({ def, transform, disabled }) {
  
  /** @type {React.Ref<HTMLCanvasElement>} */
  const canvasRef = React.useRef(null);
  const hash = React.useMemo(() => hashText(JSON.stringify(def)), [def]);

  const { data: gm, error } = useQuery(
    `GeomorphEdit--${def.key}--${hash}`,
    () => createGeomorphData(def.key),
    { keepPreviousData: true, enabled: !disabled },
  );

  const gmGraph = useGeomorphs([{ layoutKey }]);

  React.useEffect(() => {
    if (gm) {
      renderGeomorph(
        gm, symbolLookup, assertNonNull(canvasRef.current), (pngHref) => loadImage(pngHref),
        { scale: 1, navTris: false },
      );
    }
  }, [gm]);

  /** @param {React.MouseEvent<HTMLElement>} e */
  const onClick = (e) => {
    const div = /** @type {HTMLDivElement} */ (e.target);
    console.log('you clicked', div);
  };

  return gm ? (
    <g className={cx("geomorph", def.key)} transform={transform}>
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
            // 🚧 show default/overridden view positions
            gmGraph.ready && gm.rooms.map((_, roomId) =>
              gm.doors.map((_, doorId) => {
                const point = gmGraph.getDoorViewPosition(0, roomId, doorId);
                return <div
                  key={`${doorId}@${roomId}`}
                  className="view-point"
                  style={{
                    left: point.x,
                    top: point.y,
                  }}
                />;
              })
            )
          }
          {
            // 🚧 show view polys
          }
        </div>
      </foreignObject>
      <image className="debug" href={gm.items[0].pngHref} x={gm.pngRect.x} y={gm.pngRect.y}/>
    </g>
  ) : null;
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
    div.view-point {
      position: absolute;
      /* cursor: pointer; */
      background: red;
      width: 5px;
      height: 5px;
      /* border: 1px solid black; */
    }
    /* circle {
      fill: red;
    } */
  }
`;

const symbolLookup = deserializeSvgJson(/** @type {*} */ (svgJson));
