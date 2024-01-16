import React from "react";
import { RenderTexture, Matrix, Rectangle } from "@pixi/core";
import { Graphics } from "@pixi/graphics";
import { Assets } from "@pixi/assets";
import { Text } from "@pixi/text";
import { Container } from "@pixi/display";
import { useQueries } from "@tanstack/react-query";

import { mapValues, testNever } from "../service/generic";
import { Poly, Vect } from "../geom";
import { gmScale } from "../world/const";
import { getGmRoomKey } from "../service/geomorph";
import useStateRef from "../hooks/use-state-ref";
import GmSprites from "./GmSprites";
import { colMatFilter3, textStyle1 } from "./const";

/**
 * Field Of View (covers unseen parts of geomorphs).
 * 
 * - initially all rooms are unseen.
 * - `state.setRoom` must be invoked to make some room visible,
 *   e.g. via `spawn {npcName} $( click 1 )`.
 *
 * @param {Props} props 
 */
export default function FOV(props) {

  const { api } = props;
  const { gmGraph, gmGraph: { gms } } = api;

  const state = useStateRef(/** @type {() => State} */ () => ({
    ready: true,
    gmId: -1,
    roomId: -1,
    lastDoorId: -1,
    prev: { gmId: -1, roomId: -1, lastDoorId: -1 },

    gmRoomIds: [],
    rootedOpenIds: gms.map(_ => []),
    polys: gms.map(_ => []),
    hadPolys: gms.map(_ => false),

    showLabels: false,
    showMask: true,

    container: /** @type {*} */ ({}),
    sprites: /** @type {*} */ ([]),
    darkTex: gms.map(gm => RenderTexture.create({
      width: gmScale * gm.pngRect.width,
      height: gmScale * gm.pngRect.height,
    })),
    labelsTex: gms.map(gm => RenderTexture.create({
      width: gmScale * gm.pngRect.width,
      height: gmScale * gm.pngRect.height,
    })),
    tex: gms.map(gm => RenderTexture.create({
      width: gmScale * gm.pngRect.width,
      height: gmScale * gm.pngRect.height,
    })),

    forgetPrev() {
      state.prev = { gmId: -1, roomId: -1, lastDoorId: -1 };
    },
    initLabelsTex(gmId) {
      const gm = gms[gmId];
      
      const topLeft = new Vect();
      for (const { text, rect } of gm.labels) {
        const pixiText = new Text(text, textStyle1);
        topLeft.set(rect.x + (rect.width/2), rect.y + (rect.height/2));
        gm.matrix.transformSansTranslate(topLeft).translate(-rect.width/2, -rect.height);
        pixiText.position.copyFrom(topLeft);
        pixiText.anchor.set(0, 0);
        tempContainer.addChild(pixiText);
      }

      tempContainer.transform.setFromMatrix(
        (new Matrix(gm.inverseMatrix.a, gm.inverseMatrix.b, gm.inverseMatrix.c, gm.inverseMatrix.d))
          .prepend(new Matrix(gmScale, 0, 0, gmScale, -gm.pngRect.x * gmScale, -gm.pngRect.y * gmScale))
      );
      api.renderInto(tempContainer, state.labelsTex[gmId])
      tempContainer.removeChildren();
    },
    initMaskTex(gmId) {
      const gm = gms[gmId];
      const gfx = tempGfx.clear().setTransform();
      // draw unlit geomorph
      gfx.beginTextureFill({ texture: api.geomorphs.unlit[gmId] })
        .drawRect(0, 0, gm.pngRect.width * gmScale, gm.pngRect.height * gmScale)
        .endFill();
      gfx.filters = [colMatFilter3]; // resolution > 1 breaks mobile
      api.renderInto(gfx, state.darkTex[gmId], true);
      gfx.filters = [];
      // draw doors as black rects
      gfx.clear().setTransform(-gmScale * gm.pngRect.x, -gmScale * gm.pngRect.y, gmScale, gmScale);
      gfx.lineStyle({ width: 1, alignment: 1 });
      gm.doors.forEach(door => gfx.beginFill(0).drawPolygon(door.poly.outline).endFill());
      api.renderInto(gfx, state.darkTex[gmId], false);
    },
    mapAct(action, timeMs) {
      switch (action) {
        case 'show':
          state.showMask = true;
          state.renderAll();
          break;
        case 'show-labels':
          state.showLabels = true;
          state.renderAll();
          break;
        case 'hide':
          state.showMask = false;
          state.renderAll();
          break;
        case 'hide-labels':
          state.showLabels = false;
          state.renderAll();
          break;
        // 🚧 eventually remove below:
        case 'show-labels-for':
        case 'show-for':
        case 'pause':
        case 'resume':
          break;
        case undefined:
          return this.showLabels ? 1 : 0;
        default:
          throw testNever(action, {
            override: `mapAct: ${action} must be in ${JSON.stringify(api.lib.fovMapActionKeys)} or undefined`,
          });
      }
    },
    preloadRender(gmId) {
      const gm = gms[gmId];
      const gfx = tempGfx.clear();
      gfx.transform.setFromMatrix(tempMatrix.set(gmScale, 0, 0, gmScale, -gm.pngRect.x * gmScale, -gm.pngRect.y * gmScale));

      gfx.lineStyle({ width: 8, color: 0x999999, alpha: 0.4 })
        .beginFill(0x111111).drawPolygon(gm.hullPoly[0].outline).endFill()
      ;
      gm.roomsWithDoors.forEach(poly =>
        gfx.lineStyle({ width: 2, color: 0x333333, alpha: 1 })
          .beginFill(0).drawPolygon(poly.outline).endFill()
      );
      gm.doors.forEach(({poly}) =>
        gfx.beginFill(0x444444).drawPolygon(poly.outline).endFill()
      );
      api.renderInto(gfx, state.tex[gmId]);
    },
    recompute() {
      if (state.gmId === -1) {// state.gmId is -1 <=> state.roomId is -1
        return;
      }
      /** @type {CoreState} */
      const curr = { gmId: state.gmId, roomId: state.roomId, lastDoorId: state.lastDoorId };
      const cmp = compareState(api, curr);
      if (!cmp.changed) {// Avoid useless updates
        return;
      }

      /**
       * @see {viewPolys} view polygons for current/adjacent geomorphs; we include the current room.
       * @see {gmRoomIds} global room ids of every room intersecting fov
       */
      const viewPolys = gmGraph.computeViews(state.gmId, state.roomId);
      const gmRoomIds = gmGraph.getGmRoomsIdsFromDoorIds(cmp.rootedOpenIds);
      // If no door is open, we at least have current room
      gmRoomIds.length === 0 && gmRoomIds.push({ gmId: state.gmId, roomId: state.roomId });

      // Must prevent adjacent geomorphs from covering hull doors (if adjacent room visible)
      const visRoomIds = gmRoomIds.flatMap(({ gmId, roomId }) => state.gmId === gmId ? roomId : []);
      const adjGmToPolys = computeAdjHullDoorPolys(state.gmId, visRoomIds, gmGraph);
      adjGmToPolys.forEach((polys, adjGmId) =>
        viewPolys[adjGmId] = polys ? Poly.union(viewPolys[adjGmId].concat(polys)) : []
      );

      /**
       * Compute masking polygons by cutting views from hullPolygon.
       * - we exclude polys between adjacent hull-doors
       * - we must be careful not to exclude small rooms
       */
      state.hadPolys = state.polys.map(x => x.length > 0);
      state.polys = viewPolys.map((polys, altGmId) =>
        (polys.length ? Poly.cutOutSafely(polys, [gms[altGmId].hullOutline]) : [])
          .filter(x => x.rect.area > 30 * 30)
      );

      state.prev = curr;
      state.rootedOpenIds = cmp.rootedOpenIds;

      // Render FOV if has non-empty polys or previously non-empty polys
      gms.forEach((_, gmId) => (state.polys.length || state.hadPolys[gmId]) &&
        state.render(gmId)
      );
      
      // Track visible rooms (assuming gmRoomIds has no dups)
      const nextGmRoomIds = gmRoomIds.map(x => ({ ...x, key: getGmRoomKey(x.gmId, x.roomId)}));
      const visibleGms = nextGmRoomIds.reduce(
        (agg, { gmId }) => (agg[gmId] = true, agg), gms.map(_ => false),
      );
      api.setVisibleGms(visibleGms);

      const added = nextGmRoomIds.filter(x => !state.gmRoomIds.some(y => y.key === x.key));
      const removed = state.gmRoomIds.filter(x => !nextGmRoomIds.some(y => y.key === x.key));
      state.gmRoomIds = nextGmRoomIds;
      api.npcs.events.next({ key: 'fov-changed', gmRoomIds: state.gmRoomIds, added, removed });
    },
    render(gmId) {
      const gm = gms[gmId];
      const polys = state.polys[gmId];
      const gfx = tempGfx.clear();
      const texture = state.darkTex[gmId];

      if (polys.length) {
        gfx.setTransform(-gmScale * gm.pngRect.x, -gmScale * gm.pngRect.y, gmScale, gmScale);
        polys.forEach(poly => {
          state.showMask
            ? gfx.beginTextureFill({ texture, matrix: tempMatrix.set(1/gmScale, 0, 0, 1/gmScale, gm.pngRect.x, gm.pngRect.y) })
            : gfx.beginFill(0);
          gfx.drawPolygon(poly.outline);
          poly.holes.forEach(hole => gfx.beginHole().drawPolygon(hole).endHole());
          gfx.endFill();
        });
      } else {
        gfx.setTransform();
        state.showMask
          ? gfx.beginTextureFill({ texture })
          : gfx.beginFill(0);
        gfx.drawRect(0, 0, gm.pngRect.width * gmScale, gm.pngRect.height * gmScale).endFill()
      }
      api.renderInto(gfx, state.tex[gmId]);

      if (state.showLabels) {
        gfx.clear().setTransform();
        gfx.beginTextureFill({ texture: state.labelsTex[gmId] });
        gfx.drawRect(0, 0, gm.pngRect.width * gmScale, gm.pngRect.height * gmScale);
        gfx.endFill();
        api.renderInto(gfx, state.tex[gmId], false);
      }

      if (api.debug.opts.gmOutlines) {
        tempMatrix.set(gmScale, 0, 0, gmScale, -gm.pngRect.x * gmScale, -gm.pngRect.y * gmScale);
        const multiplied = tempMatrix.append(new Matrix(...gm.inverseMatrix.toArray()));
        gfx.clear().transform.setFromMatrix(multiplied);
        gfx.lineStyle({ color: 'green', width: 4 })
        gfx.drawRect(gm.gridRect.x, gm.gridRect.y, gm.gridRect.width, gm.gridRect.height);
        api.renderInto(gfx, state.tex[gmId], false);
      }
    },
    renderAll() {
      gms.map((_, gmId) => setTimeout(() => state.render(gmId)));
    },
    setRoom(gmId, roomId, doorId) {
      if (state.gmId !== gmId || state.roomId !== roomId || state.lastDoorId === -1) {
        [state.gmId, state.roomId, state.lastDoorId] = [gmId, roomId, doorId];
        state.recompute();
        api.debug.updateDebugRoom();
        return true;
      } else {
        return false;
      }
    },
    setRoomByNpc(npcKey) {
      const npc = api.npcs.getNpc(npcKey);
      const position = npc.getPosition();
      const found = (// Fallback includes doors, picking some connected roomId
        api.gmGraph.findRoomContaining(position, false)
        || api.gmGraph.findRoomContaining(position, true)
      );
      if (found) {
        props.api.fov.setRoom(found.gmId, found.roomId, -1);
        return found;
      } else {
        console.error(`setRoomByNpc: ${npcKey}: no room/door contains ${JSON.stringify(position)}`)
        return null;
      }
    },
  }), {
    overwrite: { gmId: true, roomId: true },
  });

  const loaded = useQueries({
    queries: gms.map((gm, gmId) => ({
      queryKey: [`${gm.key}.${gmId}`], // gmId for dups
      queryFn: async () => {
        state.preloadRender(gmId);
        const sprite = state.sprites[gmId];
        api.tween(sprite).to({ alpha: 1 }, 800).promise({ alpha: 0 });

        await Promise.all(/** @type {const} */ (['lit', 'unlit']).map(async type =>
          api.geomorphs[type][gmId] = await Assets.load(`/assets/geomorph/${gm.key}.${type}.webp`)
        ));
        api.doors.initTex(gmId);
        state.initMaskTex(gmId);
        state.initLabelsTex(gmId);

        await api.tween(sprite).to({ alpha: 0 }, 400).promise();
        state.render(gmId);
        await api.tween(sprite).to({ alpha: 1 }, 800).promise();

        api.geomorphs.initTex(gmId);
        api.decor.initLookups(gmId);
        api.decor.initTex(gmId);
        api.geomorphs.initHit(gmId);
        return null;
      },
      throwOnError: true,
      gcTime: Infinity,
      staleTime: Infinity,
      refetchOnMount: /** @type {const} */ ('always'),
    })).concat({
      queryKey: ['decor-spritesheet'],
      async queryFn() {
        /** @type {import('pixi.js').Texture} */
        const tex = await Assets.load(`/assets/decor/spritesheet.webp`);
        /** @type {NPC.DecorSpriteSheet} */
        const meta  = await Assets.load(`/assets/decor/spritesheet.json`);
        const lookup = mapValues(meta.lookup, ({ x, y, width, height }) => {
          const texture = tex.clone();
          texture.frame = new Rectangle(x, y, width, height);
          return texture;
        });
        api.decor.sheet = { tex, lookup };
        return null;
      },
      throwOnError: true,
      gcTime: Infinity,
      staleTime: Infinity,
      refetchOnMount: /** @type {const} */ ('always'),
    }),
    combine: x => x.every(y => y.isSuccess && !y.isFetching),
  });

  React.useEffect(() => {
    loaded && props.onLoad(state);
    // process.env.NODE_ENV === 'development' && api.isReady() && state.renderAll();
  }, [loaded]);

  return (
    <GmSprites
      ref={container => {
        if (container) {
          state.container = container;
          state.sprites = container.children;
        }
      }}
      gms={gms}
      tex={state.tex}
      // visible={gms.map(_ => false)} // 🚧 `npc cfg fov`
    />
  );
}

/**
 * @typedef Props
 * @property {import('./WorldPixi').State} api
 * @property {(fovApi: State) => void} onLoad
 */

/** @typedef State @type {CoreState & AuxState} */

/**
 * @typedef AuxState
 * @property {boolean} ready
 * @property {CoreState} prev Previous state, last time we updated clip path
 * @property {(Geomorph.GmRoomId & { key: string })[]} gmRoomIds
 * @property {number[][]} rootedOpenIds
 * `rootedOpenIds[gmId]` are the open door ids in `gmId` reachable from the FOV "root room".
 * They are induced by `state.gmId`, `state.roomId` and also the currently open doors.
 * @property {boolean[]} hadPolys Aligned to gms
 * @property {Geom.Poly[][]} polys Aligned to gms
 * 
 * @property {import('pixi.js').Container} container
 * @property {import('pixi.js').Sprite[]} sprites
 * @property {import('pixi.js').RenderTexture[]} darkTex
 * @property {import('pixi.js').RenderTexture[]} labelsTex
 * @property {import('pixi.js').RenderTexture[]} tex
 * @property {boolean} showLabels
 * @property {boolean} showMask
 * 
 * @property {(gmId: number) => void} initLabelsTex
 * @property {() => void} forgetPrev
 * @property {(gmId: number) => void} initMaskTex
 * @property {(gmId: number) => void} preloadRender
 * @property {() => void} recompute
 * @property {(gmId: number) => void} render
 * @property {() => void} renderAll
 * @property {(gmId: number, roomId: number, doorId: number) => boolean} setRoom
 * @property {(npcKey: string) => Geomorph.GmRoomId | null} setRoomByNpc
 * 
 * @property {(action?: NPC.FovMapAction, showMs?: number) => void} mapAct
*/

/**
 * @typedef CoreState
 * @property {number} gmId Current geomorph id
 * @property {number} roomId Current room id (relative to geomorph)
 * @property {number} lastDoorId Last traversed doorId in geomorph `gmId`
 */



/**
 * @param {import('./WorldPixi').State} api
 * @param {CoreState} next
 */
function compareState(api, next) {
  const { prev, rootedOpenIds } = api.fov;
  const nextRootedOpenIds = api.gmGraph.getViewDoorIds(next.gmId, next.roomId).map(x => Array.from(x));

  const justSpawned = prev.gmId === -1;
  const changedRoom = !justSpawned && !(prev.gmId === next.gmId && prev.roomId === next.roomId);
  
  const rootedOpenedIds = nextRootedOpenIds.map((doorIds, gmId) =>
    doorIds.filter(doorId => !rootedOpenIds[gmId].includes(doorId))
  );
  const rootedClosedIds = rootedOpenIds.map((doorIds, gmId) =>
    doorIds.filter(doorId => !nextRootedOpenIds[gmId].includes(doorId))
  );

  return {
    justSpawned,
    changedRoom,
    rootedOpenIds: nextRootedOpenIds,
    rootedOpenedIds,
    rootedClosedIds,
    changed: (
      justSpawned
      || changedRoom
      || rootedOpenedIds.some(x => x.length)
      || rootedClosedIds.some(x => x.length)
    ),
  };
}

/**
 * Adjacent gmId to hullDoor polys we should remove
 * @param {number} gmId 
 * @param {number[]} visRoomIds 
 * @param {Graph.GmGraph} gmGraph 
 */
function computeAdjHullDoorPolys(gmId, visRoomIds, gmGraph) {
  const adjGmToPolys = /** @type {(Poly[] | undefined)[]} */ ([]);
  const hullDoorNodes = gmGraph.doorNodeByGmId[gmId];
  for (const hullDoorNode of hullDoorNodes) {
    const adjHullDoorNode = gmGraph.getAdjacentDoor(hullDoorNode);
    if (adjHullDoorNode) {
      const hullDoor = gmGraph.gms[gmId].hullDoors[hullDoorNode.hullDoorId];
      const otherHullDoor = gmGraph.gms[adjHullDoorNode.gmId].hullDoors[adjHullDoorNode.hullDoorId];
      // only add if adjacent room is visible
      if (hullDoor.roomIds.some(roomId => roomId !== null && visRoomIds.includes(roomId))) {
        (adjGmToPolys[adjHullDoorNode.gmId] ??= []).push(otherHullDoor.poly);
      }
    }
  }
  return adjGmToPolys;
}

const tempContainer = new Container;
const tempMatrix = new Matrix;
const tempGfx = new Graphics;
