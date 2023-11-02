import React from "react";
import type PIXI from "pixi.js";
import { PixiComponent, useApp } from "@pixi/react";
import { Viewport as PixiViewport } from "pixi-viewport";

const PixiComponentViewport = PixiComponent("Viewport", {
  create: ({ app }: PixiComponentViewportProps) => {
    app.renderer.events.domElement = app.renderer.view as any;

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
      minScale: 1/4,
    });
    return viewport;
  },
  willUnmount: (viewport: PixiViewport) => {
    // These two lines fix the `ticker` option above
    viewport.options.noTicker = true;
    viewport.destroy({ children: true, texture: true, baseTexture: true });
  },
});

export default function Viewport(props: ViewportProps) {
  const app = useApp();
  return <PixiComponentViewport app={app} {...props} />;
}

export interface ViewportProps {
  children?: React.ReactNode;
}

export interface PixiComponentViewportProps extends ViewportProps {
  app: PIXI.Application;
}
