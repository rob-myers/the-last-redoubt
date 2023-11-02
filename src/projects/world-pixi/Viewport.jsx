import React, { forwardRef } from "react";
import { PixiComponent, useApp } from "@pixi/react";
import { Viewport as PixiViewport } from "pixi-viewport";

const PixiComponentViewport = PixiComponent("Viewport", {
  
  /** @param {PixiComponentViewportProps} props  */
  create: ({ app }) => {
    app.renderer.events.domElement = /** @type {*} */ (app.renderer.view);

    const viewport = new PixiViewport({
      passiveWheel: false,
      events: app.renderer.events,
      ticker: app.ticker,
    });
    viewport.drag({
      wheel: false,
    }).wheel({
      wheelZoom: true,
    }).pinch().clampZoom({
      maxScale: 4,
      minScale: 1/8,
    }).decelerate({
      friction: 0.5,
    });
    return viewport;
  },
  /** @param {PixiViewport} viewport */
  willUnmount: (viewport) => {
    // These two lines fix the `ticker` option above
    viewport.options.noTicker = true;
    viewport.destroy({ children: true, texture: true, baseTexture: true });
  },
});

/** @type {ReturnType<typeof forwardRef<PixiViewport, ViewportProps>>} */
export const Viewport = forwardRef(/** @param {ViewportProps} props */ function Viewport(props) {
  const app = useApp();
  return <PixiComponentViewport app={app} {...props} />;
});

export default Viewport;

/**
 * @typedef {React.PropsWithChildren<{}>} ViewportProps
 */

/**
 * @typedef {ViewportProps & { app: import("pixi.js").Application  }} PixiComponentViewportProps
 */
