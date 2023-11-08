import React, { forwardRef } from "react";
import { PixiComponent, useApp } from "@pixi/react";
import { Viewport as PixiViewport } from "pixi-viewport";

const PixiComponentViewport = PixiComponent("Viewport", {
  
  /** @param {PixiComponentViewportProps} props  */
  create: ({ app, initScale }) => {
    app.renderer.events.domElement = /** @type {*} */ (app.renderer.view);

    const viewport = new PixiViewport({
      passiveWheel: false,
      events: app.renderer.events,
      ticker: app.ticker,
    }).drag({
      wheel: false,
      // wheelScroll: 0.1,
    }).wheel({
      wheelZoom: true,
      // percent: 0.01,
    }).pinch({
      // percent: 0.1,
    }).clampZoom({
      maxScale: 4,
      minScale: 0.1,
    }).decelerate({
      friction: 0.5,
    });

    if (initScale) {
      viewport.scale.set(initScale);
    }
    return viewport;
  },
  /** @param {PixiViewport} viewport */
  willUnmount: (viewport) => {
    viewport.options.noTicker = true; // Fix the `ticker` option above
    viewport.destroy({ children: true });
  },
});

/** @type {ReturnType<typeof forwardRef<PixiViewport, ViewportProps>>} */
export const Viewport = forwardRef(/** @param {ViewportProps} props */ function Viewport(props) {
  const app = useApp();
  return <PixiComponentViewport app={app} {...props} />;
});

export default Viewport;

/**
 * @typedef ViewportProps
 * @property {React.ReactNode} children
 * @property {number} [initScale]
 */

/**
 * @typedef {ViewportProps & { app: import("pixi.js").Application  }} PixiComponentViewportProps
 */
