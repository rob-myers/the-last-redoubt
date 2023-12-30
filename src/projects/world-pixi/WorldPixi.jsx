import { css } from "@emotion/css";
import React from "react";
import { Stage } from "@pixi/react";
import { Extract } from "@pixi/extract";
import { Graphics } from "@pixi/graphics";
import { Container } from "@pixi/display";

import { QueryClientProvider } from "@tanstack/react-query";
import useMeasure from "react-use-measure";
import { filter, first, map, take } from "rxjs/operators";
import { merge } from "rxjs";
import * as TWEEN from "@tweenjs/tween.js";

import { precision, removeFirst } from "../service/generic";
import { queryClient, removeCached, setCached } from "../service/query-client";
import { npcService } from "../service/npc";
import { Vect } from "../geom";

import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useGeomorphs from "../geomorph/use-geomorphs";
import useHandleEvents from "./use-handle-events";
import PanZoom from "./PanZoom";
import Geomorphs from "./Geomorphs";
import Doors from "./Doors";
import NPCs from "./NPCs";
import DebugWorld from "./DebugWorld";
import Decor from "./Decor";
import FOV from "./FOV";
import { Origin } from "./Misc";

import TestPreRenderNpc from "./TestPreRenderNpc";
// import TestSpine from "./TestSpine";

/**
 * @param {Props} props
 */
export default function WorldPixi(props) {

  const state = useStateRef(/** @type {() => State} */ () => ({
    disabled: !!props.disabled,
    gmGraph: /** @type {*} */ ({}),
    gmRoomGraph: /** @type {*} */ ({}),
    visibleGms: props.gms.map(_ => false),

    pixiApp: /** @type {*} */ ({}),
    canvas: /** @type {*} */ ({}),
    renderer: /** @type {*} */ ({}),
    extract: /** @type {*} */ ({}),
    ticker: npcService.createTicker(),
    tweenGroup: new TWEEN.Group(),

    decor: /** @type {State['decor']} */  ({ ready: false }),
    debug: /** @type {State['debug']} */  ({ ready: false }),
    doors: /** @type {State['doors']} */  ({ ready: false }),
    fov: /** @type {State['fov']} */  ({ ready: false }),
    geomorphs: /** @type {State['geomorphs']} */  ({ ready: false }),
    npcs: /** @type {State['npcs']} */  ({ ready: false }),
    panZoom: /** @type {State['panZoom']} */  ({ ready: false }),
    lib: {
      filter, first, map, merge, take,
      isVectJson: Vect.isVectJson,
      vectFrom: Vect.from,
      precision, removeFirst,
      ...npcService,
    },

    isReady() {
      return [
        state.panZoom,
        state.geomorphs, 
        state.debug, 
        state.decor, 
        state.npcs, 
        state.doors, 
        state.fov,
      ].every(x => x.ready);
    },
    clearInto(tex) {
      state.renderer.render(emptyGraphics, { renderTexture: tex, clear: true });
    },
    onTick(deltaRatio) {
      state.tweenGroup.update();
      for (const npcKey in state.npcs.npc) {
        state.npcs.npc[npcKey].updateTime(deltaRatio);
      }
    },
    renderInto(displayObj, tex, clear = true) {
      state.renderer.render(displayObj, { renderTexture: tex, clear });
    },
    renderRect(displayObj, tex, rect) {
      const mask = emptyGraphics.beginFill().drawRect(rect.x, rect.y, rect.width, rect.height);
      displayObj.mask = mask;
      emptyContainer.addChild(displayObj, mask);
      state.renderer.render(emptyContainer, { renderTexture: tex, clear: false });
      displayObj.mask = null;
      emptyGraphics.clear();
      emptyContainer.removeChildren();
    },
    setCursor(cssValue) {
      state.canvas.style.cursor = cssValue;
    },
    setTicker(enabled) {
      state.ticker.remove(state.onTick).stop();
      enabled && state.ticker.add(state.onTick).start();
    },
    setVisibleGms(visibleGms) {
      state.visibleGms = visibleGms;
      update();
    },
    tween(target) {
      const tween = new TWEEN.Tween(target, state.tweenGroup);
      return Object.assign(tween, {
        /** @param {Record<string, any>} [initValue] */
        promise: (initValue) => new Promise((resolve, reject) => {
          initValue && Object.assign(target, initValue);
          tween.onComplete(resolve).onStop(() => reject('cancelled')).start();
        }),
      });
    },
  }));

  useHandleEvents(state, props.disabled);

  ({ gmGraph: state.gmGraph,
     gmRoomGraph: state.gmRoomGraph,
   } = useGeomorphs(props.gms, props.disabled));
  state.gmGraph.api = state.gmRoomGraph.api = state;

  React.useEffect(() => {
    setCached([props.worldKey], state);
    return () => removeCached([props.worldKey]);
  }, []);

  const [rootRef, bounds] = useMeasure({ debounce: 30, scroll: false });
  
  const update = useUpdate();

  return (
    <div
      ref={rootRef}
      className={rootCss}
    >
      {state.gmGraph.ready && (
        <Stage
          options={{
            hello: true,
            antialias: true,
            resolution: window.devicePixelRatio > 1 ? 2 : 1,
            powerPreference: 'low-power',
            backgroundColor: 0x111111,
            eventFeatures: { globalMove: true, move: true, click: true, wheel: true },
            // resolution: 4, // ℹ️ no zoom flicker, but can set on filter
          }}
          onMount={app => {
            state.pixiApp = app;
            state.canvas = /** @type {*} */ (app.view);
            state.renderer = /** @type {*} */ (app.renderer);
            state.extract = new Extract(state.renderer);
            // https://chromewebstore.google.com/detail/pixijs-devtools/aamddddknhcagpehecnhphigffljadon
            process.env.NODE_ENV === 'development' && (
              /** @type {*} */ (globalThis).__PIXI_APP__ = app
            );
          }}
          width={bounds.width || undefined}
          height={bounds.height || undefined}
        >
          <QueryClientProvider client={queryClient}>
            <PanZoom
              api={state}
              onLoad={api => (state.panZoom = api) && update()}
              initScale={1}
            >
              <Geomorphs
                api={state}
                onLoad={api => (state.geomorphs = api) && update()}
              />

              <Decor
                api={state}
                onLoad={api => (state.decor = api) && update()}
              />

              <DebugWorld
                api={state}
                onLoad={api => (state.debug = api) && update()}
              />

              <NPCs
                api={state}
                onLoad={api => (state.npcs = api) && update()}
              />

              <Doors
                api={state}
                onLoad={api => (state.doors = api) && update()}
                init={{ 0: [28] }} // 🚧 test
              />

              <FOV
                api={state}
                onLoad={api => (state.fov = api) && update()}
              />

              <Origin />

              {/* <TestSpine api={state} /> */}
              {/* {state.npcs.ready && <TestPreRenderNpc api={state} disabled={props.disabled} />} */}

            </PanZoom>
          </QueryClientProvider>
        </Stage>
      )}
    </div>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {Geomorph.UseGeomorphsDefItem[]} gms
 * @property {string} worldKey
 */

/**
 * @typedef State
 * @property {boolean} disabled
 * @property {Graph.GmGraph} gmGraph
 * @property {Graph.GmRoomGraph} gmRoomGraph
 * @property {boolean[]} visibleGms Aligned to `props.gms`
 * 
 * @property {import("pixi.js").Application} pixiApp
 * @property {HTMLCanvasElement} canvas
 * @property {import("pixi.js").Renderer} renderer
 * @property {import("pixi.js").Extract} extract
 * @property {import('pixi.js').Ticker} ticker
 * @property {import('@tweenjs/tween.js').Group} tweenGroup
 *
 * @property {import("./DebugWorld").State} debug
 * @property {import("./Decor").State} decor
 * @property {import("./Doors").State} doors
 * @property {import("./FOV").State} fov
 * @property {import("./Geomorphs").State} geomorphs
 * @property {StateUtil & import("../service/npc").NpcServiceType} lib
 * @property {import("./NPCs").State} npcs
 * @property {import('./PanZoom').State} panZoom
 *
 * @property {() => boolean} isReady
 * @property {(tex: import("pixi.js").RenderTexture) => void} clearInto
 * @property {(deltaRatio: number) => void} onTick
 * @property {(displayObj: import("pixi.js").DisplayObject, tex: import("pixi.js").RenderTexture, clear?: boolean) => void} renderInto
 * @property {(displayObj: import("pixi.js").DisplayObject, tex: import("pixi.js").RenderTexture, rect: Geom.RectJson) => void} renderRect
 * @property {(cssCursorValue: string) => void} setCursor
 * @property {(enabled: boolean) => void} setTicker
 * @property {(visibleGms: boolean[]) => void} setVisibleGms
 * @property {(target: any) => NPC.TweenExt} tween
 */

/**
 * @typedef StateUtil Utility classes and `rxjs` functions
 * @property {typeof import('../geom').Vect['isVectJson']} isVectJson
 * @property {typeof import('../geom').Vect['from']} vectFrom
 * @property {typeof filter} filter
 * @property {typeof first} first
 * @property {typeof map} map
 * @property {typeof merge} merge
 * @property {typeof precision} precision
 * @property {typeof removeFirst} removeFirst
 * @property {typeof take} take
 */

const rootCss = css`
  width: 100%;
  height: 100%;
  
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
`;

const emptyGraphics = new Graphics;
const emptyContainer = new Container;
