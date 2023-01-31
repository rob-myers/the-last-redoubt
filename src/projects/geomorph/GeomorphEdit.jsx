/**
 * This component is used to build a geomorph step-by-step.
 * We compute the actual layout (as opposed to loading JSON).
 */
import * as React from "react";
import { css, cx } from "@emotion/css";
import { useQuery } from "react-query";

import { Poly } from "../geom/poly";
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
// const layoutKey = 'g-101--multipurpose';
// const layoutKey = 'g-102--research-deck';
const layoutKey = 'g-301--bridge';
// const layoutKey = 'g-302--xboat-repair-bay';
// const layoutKey = 'g-303--passenger-deck';

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
  
  const hash = React.useMemo(() => hashText(JSON.stringify(def)), [def]);
  /** @type {React.Ref<HTMLCanvasElement>} */
  const canvasRef = React.useRef(null);
  const [openDoors, setOpenDoors] = React.useState(/** @type {number[]} */ ([]));
  const [viewPoly, setViewPoly] = React.useState(new Poly);

  const { data: gm, error } = useQuery(
    `GeomorphEdit--${def.key}--${hash}`,
    () => createGeomorphData(def.key),
    { keepPreviousData: true, enabled: !disabled },
  );

  const gmGraph = useGeomorphs([{ layoutKey }]);
  // Provide state needed by gmGraph
  gmGraph.api.doors = /** @type {import('../world/Doors').State} */ ({
    getOpen(_) { return openDoors; },
    get open() { return [gm?.doors.map((_, doorId) => openDoors.includes(doorId))??[]]; },
  });

  React.useEffect(() => {
    if (gm) {
      renderGeomorph(
        gm, symbolLookup, assertNonNull(canvasRef.current), (pngHref) => loadImage(pngHref),
        { scale: 1, navTris: false },
      );
    }
  }, [gm]);

  /** @param {React.MouseEvent<HTMLElement>} e */
  function onClick(e) {
    const el = /** @type {HTMLElement} */ (e.target);
    const meta = el.dataset;
    if (meta.key === 'door') {
      const doorId = Number(meta.doorId);
      setOpenDoors(
        openDoors.includes(doorId) ? openDoors.filter(x => x !== doorId) : openDoors.concat(doorId)
      );
    } else if (meta.key === 'view') {
      const roomId = Number(meta.roomId);
      const { polys: viewPolys } = gmGraph.computeViewPolygons(0, roomId);
      setViewPoly(viewPolys[0][0]);
    }
  }

  return gm ? (
    <g className={cx("geomorph", def.key)} transform={transform}>
      <image className="debug" href={gm.items[0].pngHref} x={gm.pngRect.x} y={gm.pngRect.y}/>
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
              className={cx("door", openDoors.includes(doorId) ? 'open' : 'closed')}
              data-key="door"
              data-door-id={doorId}
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
              data-key="label"
              style={{
                left: padded.x - gm.pngRect.x,
                top: padded.y - gm.pngRect.y,
              }}
            >
              {text}
            </div>
          ))}
          {
            gmGraph.ready && gm.rooms.map((_, roomId) =>
              gm.doors.map(({ roomIds }, doorId) => {
                if (!roomIds.includes(roomId)) return null; // 🚧 use roomGraph instead?
                const point = gmGraph.getDoorViewPosition(0, roomId, doorId);
                return <div
                  key={`${doorId}@${roomId}`}
                  className="view-point"
                  data-key="view"
                  data-room-id={roomId}
                  style={{
                    left: point.x,
                    top: point.y,
                  }}
                />;
              }
            ))
          }
        </div>
      </foreignObject>

      <path
        fill="#ff000055"
        stroke="red"
        d={viewPoly.svgPath}
      />
    </g>
  ) : null;
}

const rootCss = css`
  background-color: #444;
  height: 100%;
  g > image.debug {
    opacity: 0.2;
  }
  g > .doors rect {
    fill: white;
    stroke: black;
  }
  g path {
    pointer-events: none;
  }

  g > foreignObject {
    font: ${labelMeta.font};

    canvas.geomorph {
      position: absolute;
      pointer-events: none;
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
      border: 1px solid black;
      &.open {
        background: none;
      }
      &.closed {
        background: red;
      }
    }
    div.view-point {
      position: absolute;
      /* pointer-events: auto; */
      cursor: pointer;
      background: red;
      width: 5px;
      height: 5px;
      border-radius: 50%;
    }
    /* circle {
      fill: red;
    } */
  }
`;

const symbolLookup = deserializeSvgJson(/** @type {*} */ (svgJson));
