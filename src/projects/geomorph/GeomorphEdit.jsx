/**
 * This component is used to build a geomorph step-by-step.
 * We compute the actual layout (as opposed to loading JSON).
 */
import * as React from "react";
import { css, cx } from "@emotion/css";
import { useQuery } from "react-query";

import { Poly } from "../geom/poly";
import { gmGraphClass } from "../graph/gm-graph";
import { createGeomorphData } from "./use-geomorph-data";
import { defaultLightDistance } from "../service/const";
import { assertDefined, hashText } from "../service/generic";
import { loadImage } from "../service/dom";
import { computeLightPolygons, createLayout, geomorphDataToInstance, labelMeta } from "../service/geomorph";
import { deserializeSvgJson } from "../service/geomorph";
import layoutDefs from "../geomorph/geomorph-layouts";
import { renderGeomorph } from "../geomorph/render-geomorph";
import * as defaults from "../example/defaults";
import svgJson from '../../../static/assets/symbol/svg.json'; // CodeSandbox?
import SvgPanZoom from '../panzoom/SvgPanZoom';
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

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

  /** Must recompute layout when definition changes (even with HMR) */
  const gmHash = React.useMemo(() => hashText(JSON.stringify(def)), [def]);
  const { data, error } = useQuery(
    `GeomorphEdit--${def.key}--${gmHash}`,
    async () => {
      // compute layout and GeomorphData from def
      const symbolLookup = deserializeSvgJson(/** @type {*} */ (svgJson));
      const layout = await createLayout(def, symbolLookup)
      const gm = await createGeomorphData(layout);
      // create geomorph graph
      const gmInstance = geomorphDataToInstance(gm, [1, 0, 0, 1, 0, 0]);
      const gmGraph = gmGraphClass.fromGms([gmInstance]);
      // ℹ️ Provide state needed by gmGraph
      gmGraph.api.doors = /** @type {import('../world/Doors').State} */ ({
        getOpen(_) { return state.openDoors; },
        get open() { return [gm?.doors.map((_, doorId) => state.openDoors.includes(doorId))??[]]; },
      });
      return { gm, gmGraph };

    },
    { keepPreviousData: true, enabled: !disabled },
  );

  const update = useUpdate();

  const state = useStateRef(() => {
    return {
      canvas: /** @type {HTMLCanvasElement} */ ({}),
      allLightPolys: /** @type {Geom.Poly[]} */ ([]),
      openDoors: /** @type {number[]} */ ([]),
      viewPoly: new Poly,
      /** `{doorId}@{roomId}` */
      lastViewId: '',
      lightPoly: new Poly,

      /** @param {React.MouseEvent<HTMLElement>} e */
      onClick(e) {
        const el = /** @type {HTMLElement} */ (e.target);
        const meta = el.dataset;
        if (meta.key === 'door') {
          const doorId = Number(meta.doorId);
          const foundIndex = state.openDoors.findIndex(id => id === doorId);
          if (foundIndex >= 0) {
            state.openDoors.splice(foundIndex, 1);
          } else {
            state.openDoors.push(doorId);
          }
          update();
        } else if (meta.key === 'view') {
          const viewId = assertDefined(meta.viewId);
          const roomId = Number(meta.roomId);
          const { polys: viewPolys } = assertDefined(data).gmGraph.computeViewPolygons(0, roomId);
          // Union needed to include current room
          state.viewPoly = viewId === state.lastViewId ? new Poly : Poly.union(viewPolys[0])[0];
          state.lastViewId = viewId;
          update();
        } else if (meta.key === 'light') {
          const lightId = Number(meta.lightId);
          const roomId = Number(meta.roomId); // 🚧
          const lightPoly = state.allLightPolys[lightId]
          state.lightPoly = state.lightPoly === lightPoly ? new Poly : lightPoly;
          update();
        }
      },
    };
  }, {
    deps: [data, layoutKey],
  });

  React.useEffect(() => {
    if (data) {
      state.canvas.getContext('2d')?.clearRect(0, 0, state.canvas.width, state.canvas.height);
      renderGeomorph(
        data.gm, symbolLookup, state.canvas, (pngHref) => loadImage(pngHref),
        { scale: 1, navTris: false },
      );
      // intersect with circles (corresponds to bake-lighting radial fill)
      state.allLightPolys = computeLightPolygons(data.gm).map((lightPoly, lightId) => {
        const { distance = defaultLightDistance, position } = data.gm.lightSrcs[lightId];
        const circlePoly = Poly.circle(position, distance, 30);
        return Poly.intersect([circlePoly], [lightPoly])[0] ?? new Poly;
      });
    }
  }, [data]);

  return data ? (
    <g
      className={cx("geomorph", def.key)}
      transform={transform}
    >
      <foreignObject {...data.gm.pngRect} xmlns="http://www.w3.org/1999/xhtml">
        <canvas
          ref={el => el && (state.canvas = el)}
          className="geomorph"
          width={data.gm.pngRect.width}
          height={data.gm.pngRect.height}
        />
        <div
          onClick={state.onClick}
          className="main-container"
          style={{ left: -data.gm.pngRect.x, top: -data.gm.pngRect.y }}
        >
          {data.gm.doors.map(({ baseRect, angle }, doorId) =>
            <div
              key={doorId}
              className={cx("door", state.openDoors.includes(doorId) ? 'open' : 'closed')}
              data-key="door"
              data-door-id={doorId}
              style={{
                left: baseRect.x,
                top: baseRect.y,
                width: baseRect.width,
                height: baseRect.height,
                transformOrigin: 'top left',
                transform: `rotate(${angle}rad)`,
              }} />
          )}
          {data.gm.labels.map(({ text, padded }, labelId) => (
            <div
              key={labelId}
              className="label"
              data-key="label"
              style={{
                left: padded.x,
                top: padded.y,
              }}
            >
              {text}
            </div>
          ))}
          {data.gmGraph.ready && data.gm.rooms.map((_, roomId) =>
            data.gm.doors.map(({ roomIds }, doorId) => {
              if (!roomIds.includes(roomId)) return null; // 🚧 use roomGraph instead?
              const point = data.gmGraph.getDoorViewPosition(0, roomId, doorId);
              const viewId = `${doorId}@${roomId}`;
              return <div
                key={viewId}
                className="view-point"
                data-key="view"
                data-view-id={viewId}
                data-room-id={roomId}
                style={{ left: point.x, top: point.y }}
              />;
            }))
          }
          {data.gm.lightSrcs.map(({ position, roomId }, i) =>
            <div
              key={i}
              className="light-point"
              data-key="light"
              data-light-id={i}
              data-room-id={roomId}
              style={{ left: position.x, top: position.y }}
            />
          )}
        </div>
      </foreignObject>

      <path
        d={state.viewPoly.svgPath}
        fill="#ff000055"
        stroke="red"
      />

      <path
        d={state.lightPoly.svgPath}
        fill="#0000ff99"
        stroke="blue"
      />

      <image className="debug" href={data.gm.items[0].pngHref} x={data.gm.pngRect.x} y={data.gm.pngRect.y}/>

    </g>
  ) : null;
}

const pointDim = 8;

const rootCss = css`
  background-color: #444;
  height: 100%;
  g {
    image.debug {
      opacity: 0.2;
      pointer-events: none;
    }
    path {
      pointer-events: none;
    }
    foreignObject {
      font: ${labelMeta.font};
  
      canvas.geomorph {
        position: absolute;
        pointer-events: none;
      }
      
      div.main-container {
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
        cursor: pointer;
        background: green;
        width: ${pointDim}px;
        height: ${pointDim}px;
        border-radius: 50%;
      }
      div.light-point {
        position: absolute;
        cursor: pointer;
        background: #ffff99;
        width: ${pointDim}px;
        height: ${pointDim}px;
        border-radius: 50%;
        border: 1px solid black;
      }
    }
  }

`;

const symbolLookup = deserializeSvgJson(/** @type {*} */ (svgJson));
