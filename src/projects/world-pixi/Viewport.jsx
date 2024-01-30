import React, { forwardRef } from "react";
import { PixiComponent, useApp } from "@pixi/react";
import { Viewport as PixiViewport } from "pixi-viewport";

/** @type {ReturnType<typeof forwardRef<PixiViewport, ViewportProps & PickedContainerProps>>} */
export const Viewport = forwardRef(
  function Viewport(props, ref) {
    const app = useApp();

    return React.createElement(PixiComponent("Viewport", {
      create: () => {
        app.renderer.events.domElement = /** @type {*} */ (app.renderer.view);
    
        const viewport = new PixiViewport({
          passiveWheel: false,
          events: app.renderer.events,
          noTicker: true, // We manually update
        }).drag({
          wheel: false,
          // factor: 1,
          // wheelScroll: 0.1,
        }).wheel({
          wheelZoom: true,
          smooth: 10,
        }).pinch({
          // percent: 0.1,
          // factor: 0.1,
        }).clampZoom({
          maxScale: 4,
          minScale: 0.1,
        }).decelerate({
          friction: 0.5,
        });
    
        return viewport;
      },
      /** @param {PixiViewport} viewport */
      willUnmount: (viewport) => {
        viewport.destroy({ children: true });
      },
    }), {
      ref,
      ...props,
    });
  },
);

export default Viewport;

/**
 * @typedef ViewportProps
 * @property {React.ReactNode} children
 */

/**
 * @typedef {import("@pixi/react").InteractionEvents &
 *  Partial<Pick<import("@pixi/display").Container, 'eventMode' | 'name'>>
 * } PickedContainerProps
 */
