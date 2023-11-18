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
import { assertDefined, hashText, tryLocalStorageGet, tryLocalStorageSet } from "../service/generic";
import { loadImage } from "../service/dom";
import { computeLightPolygons, createLayout, geomorphDataToInstance, labelMeta, deserializeSvgJson, geomorphKeys } from "../service/geomorph";
import layoutDefs from "../geomorph/geomorph-layouts";
import { renderGeomorph } from "../geomorph/render-geomorph";
import * as defaults from "../example/defaults";
import svgJson from '../../../static/assets/symbol/svg.json'; // CodeSandbox?
import SvgPanZoom from '../panzoom/SvgPanZoom';
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";


/** @param {Props} props */
export default function GeomorphEdit({ disabled }) {

  const [layoutKey, setLayoutKey] = React.useState(
    /** @returns {Geomorph.GeomorphKey} */ () =>
      tryLocalStorageGet('gmKey@GeomorphEdit') ?? 'g-301--bridge',
  );

  return (
    <div className={rootCss}>
      <select
        defaultValue={layoutKey}
        onChange={x => {
          const gmKey = /** @type {Geomorph.GeomorphKey} */ (x.currentTarget.value);
          setLayoutKey(gmKey);
          tryLocalStorageSet('gmKey@GeomorphEdit', gmKey);
        }}
      >
        {geomorphKeys.map(gmKey => <option key={gmKey}>{gmKey}</option>)}
      </select>
      <SvgPanZoom
        initViewBox={defaults.initViewBox}
        gridBounds={defaults.gridBounds}
        minZoom={0.2}
        maxZoom={6}
      >
        <Geomorph layoutKey={layoutKey} />
      </SvgPanZoom>
    </div>
  );
}

/** @param {{ layoutKey: Geomorph.GeomorphKey; transform?: string; disabled?: boolean }} _ */
function Geomorph({ layoutKey, transform, disabled }) {

  const def = layoutDefs[layoutKey];
  /**
   * Must recompute layout when definition changes,
   * so we can edit geomorph-layouts.
   */
  const gmHash = React.useMemo(() => hashText(JSON.stringify(def)), [def]);

  const { data, error } = useQuery(
    `GeomorphEdit--${def.key}--${gmHash}`,
    async () => {
      // Compute layout and GeomorphData from def,
      // where triangle service means degenerate navigation
      const layout = await createLayout({ def, lookup: symbolLookup, triangleService: null})
      const gm = await createGeomorphData(layout);

      // Create geomorph graph,
      // providing minimal state needed by gmGraph
      const gmInstance = geomorphDataToInstance(gm, 0, [1, 0, 0, 1, 0, 0]);
      const gmGraph = gmGraphClass.fromGms([gmInstance], true);
      gmGraph.api.doors = /** @type {import('../world/Doors').State} */ ({
        getOpenIds(_) { return state.openDoors; },
        isOpen(gmId, doorId) { return state.openDoors.includes(doorId); },
        get lookup() { return [gm?.doors.map((_, doorId) => ({ open: state.openDoors.includes(doorId) })) ?? []]; },
      });
      return { gm, gmGraph };
    },
    { enabled: !disabled },
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
      lastRoomId: -1,
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
          if (state.lastViewId && state.lastRoomId >= -1) {// Update view
            const viewPolys = assertDefined(data).gmGraph.computeViews(0, state.lastRoomId);
            state.viewPoly = Poly.union(viewPolys[0])[0];
          }
          update();
        } else if (meta.key === 'view') {
          const viewId = assertDefined(meta.viewId);
          const roomId = Number(meta.roomId);
          const viewPolys = assertDefined(data).gmGraph.computeViews(0, roomId);
          if (viewId === state.lastViewId) {
            state.viewPoly = new Poly;
            state.lastViewId = '';
            state.lastRoomId = -1;
          } else {// Union needed to include current room
            state.viewPoly = Poly.union(viewPolys[0])[0];
            state.lastViewId = viewId;
            state.lastRoomId = roomId;
          }
          update();
        } else if (meta.key === 'light') {
          const lightId = Number(meta.lightId);
          const roomId = Number(meta.roomId); // 🚧
          const lightPoly = state.allLightPolys[lightId]
          state.lightPoly = state.lightPoly === lightPoly ? new Poly : lightPoly;
          update();
        }
      },

      reset() {
        state.canvas.getContext?.('2d')?.clearRect(0, 0, state.canvas.width, state.canvas.height);
        state.viewPoly = new Poly;
        state.lightPoly = new Poly;
        state.lastViewId = '';
        state.lastRoomId = -1;
      },
    };
  }, {
    deps: [data, layoutKey],
  });

  React.useEffect(() => {
    state.reset();
    if (data) {
      state.canvas.getContext?.('2d')?.clearRect(0, 0, state.canvas.width, state.canvas.height);
      renderGeomorph(
        data.gm, symbolLookup, state.canvas, (pngHref) => loadImage(pngHref),
        {
          scale,
          navTris: false,
          invertSymbols: true,
        },
      );
      // intersect with circles (corresponds to bake-lighting radial fill)
      state.allLightPolys = computeLightPolygons(data.gm, true);
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
          style={{ transformOrigin: 'top left', transform: `scale(${1 / scale})` }}
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
          {data.gm.labels.map(({ text, rect }, labelId) => (
            <div
              key={labelId}
              className="label"
              data-key="label"
              style={{
                left: rect.x,
                top: rect.y,
              }}
            >
              {text}
            </div>
          ))}
          {data.gmGraph.ready && data.gm.rooms.map((_, roomId) =>
            data.gm.doors.map(({ roomIds }, doorId) => {
              if (!roomIds.includes(roomId)) return null; // 🚧 use roomGraph instead?
              const points = data.gm.getViewDoorPositions(roomId, doorId);
              return points.map((point, i) => {
                const viewId = `${doorId}@${roomId}${points.length > 1 ? `@${i}` : ''}`;
                return <div
                  key={viewId}
                  className="view-point"
                  data-key="view"
                  data-view-id={viewId}
                  data-room-id={roomId}
                  style={{ left: point.x, top: point.y }}
                />;
              });
            }))
          }
          {data.gm.lightSrcs.map(({ position, roomId, distance = defaultLightDistance }, i) => [
            <div
              key={i}
              className="light-point"
              data-key="light"
              data-light-id={i}
              data-room-id={roomId}
              style={{ left: position.x, top: position.y }}
            />,
            // 🚧 too many lights to witness intersections with other light's lightRect
            // <div
            //   key={`${i}-circ`}
            //   className="light-circ"
            //   data-key="light-circ"
            //   data-light-id={i}
            //   data-room-id={roomId}
            //   style={{ left: position.x, top: position.y, width: distance * 2, height: distance * 2,  transform: `translate(-${distance}px, -${distance}px)` }}
            // />,
          ])}
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

      {data.gm.lightThrus.map(({ poly }, i) =>
        <path
          key={i}
          d={poly.svgPath}
          stroke="blue"
          fill="none"
          strokeDasharray="2 2"
        />
      )}

      <image className="debug" href={data.gm.items[0].pngHref} x={data.gm.pngRect.x} y={data.gm.pngRect.y}/>

    </g>
  ) : null;
}

const scale = 2;
const pointDim = 8;

const rootCss = css`
  background-color: #444;
  height: 100%;

  select {
    position: absolute;
    right: 0;
  }

  g {
    image.debug {
      opacity: 0.2;
      pointer-events: none;
    }
    path {
      pointer-events: none;
    }

    /* ℹ️ foreignObject { ... } did not match */

    font: ${labelMeta.font};

    canvas.geomorph {
      position: absolute;
      pointer-events: none;
    }
    
    .main-container {
      position: absolute;
    }

    div.label {
      position: absolute;
      /* padding: 2px; */
      /* cursor: pointer; */
      pointer-events: auto;
      user-select: none;
      color: black;
      font-weight: bold;
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
      transform: translate(-${pointDim/2}px, -${pointDim/2}px);
      border-radius: 50%;
    }
    div.light-point {
      position: absolute;
      cursor: pointer;
      background: #ffff99;
      width: ${pointDim}px;
      height: ${pointDim}px;
      transform: translate(-${pointDim/2}px, -${pointDim/2}px);
      border-radius: 50%;
      border: 1px solid black;
    }
    div.light-circ {
      position: absolute;
      background: #0000ff11;
      border-radius: 50%;
      pointer-events: none;
    }
    div.light-rect {
      position: absolute;
      border: 1px dashed #0000ff;
      pointer-events: none;
    }
  }

`;

const symbolLookup = deserializeSvgJson(/** @type {*} */ (svgJson));

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */
