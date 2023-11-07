import React from "react";
import { useQueries, useQuery } from "react-query";

import { Container, Sprite } from "@pixi/react";
import { Assets } from "@pixi/assets";
import { RenderTexture, autoDetectRenderer } from "@pixi/core";
import { Graphics } from "@pixi/graphics";
// import * as PixiSprite from "@pixi/sprite";

import { gmScale } from "../world/const";
import { pause } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { colorMatrixFilter } from "./Misc";

/**
 * @param {Props} props 
 */
export default function Geomorphs(props) {
  const { api } = props;
  const { gmGraph: { gms } } = api;
  const update = useUpdate();

  useQueries(
    gms.map((gm, gmId) => ({
      queryKey: `${gm.key}.lit`,
      queryFn: async () => {
        state.initTex(gmId); // initial cheap graphics
        update();

        // load lit/unlit and store in state
        /** @type {import('pixi.js').Texture[]} */
        const [lit, unlit] = await Promise.all(['.lit.webp', '.webp'].map(ext =>
          Assets.load(`/assets/geomorph/${gm.key}${ext}`)
        ));
        state.tex.lit[gmId] = lit;
        state.tex.unlit[gmId] = unlit;

        const gfx = new Graphics();
        // draw lit
        gfx.beginTextureFill({ texture: lit });
        gfx.drawRect(0, 0, gm.pngRect.width * gmScale, gm.pngRect.height * gmScale);
        gfx.endFill();
        // draw all unlit rects
        gm.doorToLightRect.forEach(x => {
          if (x) {
            gfx.beginTextureFill({ texture: unlit });
            gfx.drawRect(gmScale * (x.rect.x - gms[gmId].pngRect.x), gmScale * (x.rect.y - gms[gmId].pngRect.y), gmScale * x.rect.width, gmScale * x.rect.height);
            gfx.endFill();
          }
        });

        // api.pixiApp.renderer.render(sprite, { renderTexture: state.tex.render[gmId] });
        api.pixiApp.renderer.render(gfx, { renderTexture: state.tex.render[gmId] });
      }
    })),
  );

  const state = useStateRef(
    /** @type {() => State} */ () => ({
      ready: true,
      tex: { load: [], lit: [], unlit: [], render: [] },

      initTex(gmId) {
        const gm = gms[gmId];
        state.tex.render[gmId] = RenderTexture.create({
          width: gmScale * gm.pngRect.width,
          height: gmScale * gm.pngRect.height,
        });
        const gfx = state.tex.load[gmId] = new Graphics();
        gfx.setTransform(gm.pngRect.x, gm.pngRect.y, gmScale, gmScale);
        gfx.lineStyle({ width: 4, color: 0xaaaaaa });
        gm.rooms.forEach(poly => {
          gfx.beginFill(0x222222);
          gfx.drawPolygon(poly.outline)
          gfx.endFill();
        });
        api.pixiApp.renderer.render(gfx, { renderTexture: state.tex.render[gmId] });
      },
    }),
  );

  React.useEffect(() => {
    props.onLoad(state);
  }, []);

  return <>
    {gms.map((gm, gmId) =>
      state.tex.render[gmId] && (
        <Container
          key={gmId}
          {...decomposeBasicTransform(gm.transform)}
          filters={[colorMatrixFilter]}
          // filters={[]}
        >
          <Sprite
            width={gm.pngRect.width}
            height={gm.pngRect.height}
            texture={state.tex.render[gmId]}
            position={{ x: gm.pngRect.x, y: gm.pngRect.y }}
          />
        </Container>
      )
    )}
  </>;
}

/**
 * 🚧 precompute
 * @param {Geom.SixTuple} transform
 * `[a, b, c, d]` are ±1 and invertible
 */
function decomposeBasicTransform([a, b, c, d, e, f]) {
  let degrees = 0, scaleX = 1, scaleY = 1;
  if (a === 1) {// degrees is 0
    scaleY = d;
  } else if (a === -1) {
    degrees = 180;
    scaleY = -d;
  } else if (b === 1) {
    degrees = 90;
    scaleX = -c;
  } else if (b === -1) {
    degrees = 270;
    scaleX = c;
  }
  return {
    scale: { x: scaleX, y: scaleY },
    angle: degrees,
    x: e,
    y: f,
  };
}

/**
 * @typedef Props @type {object}
 * @property {import('./WorldPixi').State} api
 * @property {(doorsApi: State) => void} onLoad
 */

/**
 * @typedef State @type {object}
 * @property {boolean} ready
 * @property {Tex} tex
 * 
 * @property {(gmId: number) => void} initTex
 * 
 * //@property {boolean[][]} isRoomLit
 * Lights on iff `isRoomLit[gmId][roomId]`.
 * //@property {(type: 'lit' | 'unlit', ctxt: CanvasRenderingContext2D, gmId: number) => CanvasPattern} createFillPattern
 * //@property {(type: 'lit' | 'unlit', gmId: number, poly: Geom.Poly) => void} drawPolygonImage
 * Fill polygon using unlit image, and also darken.
 * //@property {(type: 'lit' | 'unlit', gmId: number, rect: Geom.RectJson) => void} drawRectImage
 * //@property {() => void} initDrawIds
 * //@property {(gmId: number) => void} initLightRects
 * Currently assumes all doors initially closed
 * //@property {() => () => void} loadImages Returns cleanup
 * //@property {(gmId: number, doorId: number) => void} onOpenDoor
 * //@property {(gmId: number, doorId: number, lightCurrent?: boolean) => void} onCloseDoor
 * //@property {(gmId: number, roomId: number)  => void} recomputeLights
 * //@property {(gmId: number, roomId: number, lit: boolean)  => void} setRoomLit
 */

/**
 * @typedef Tex
 * @property {import('pixi.js').Graphics[]} load
 * @property {import('pixi.js').Texture[]} lit
 * @property {import('pixi.js').Texture[]} unlit
 * @property {import('pixi.js').RenderTexture[]} render
 */