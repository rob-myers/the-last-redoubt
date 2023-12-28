import { Texture, Rectangle } from "@pixi/core";
import { Sprite } from "@pixi/sprite";
import anime from 'animejs';

import { Rect, Vect } from '../geom';
import spineMeta from "static/assets/npc/top_down_man_base/spine-meta.json";
import { npcClassToSpineHeadSkin, spineAnimToSetup } from "./const";

/**
 * @param {NPC.NPCDef} def
 * @param {import('./WorldPixi').State} api
 * //@returns {NPC.NPC}
 */
export default function createNpc(def, api) {
  const { baseTexture } = api.npcs.tex;
  const sharedAnimData = getSharedAnimData('idle');
  const headSkinName = npcClassToSpineHeadSkin[def.classKey];

  return {
    key: def.key,
    classKey: def.classKey,
    epochMs: Date.now(),
    def,

    el: /** @type {*} */ ({}), // Fix types during migration
    s: {
      body: new Sprite(new Texture(baseTexture)),
      head: new Sprite(new Texture(baseTexture)),
    },

    anim: /** @type {*} */ ({}), // Fix types during migration
    a: {
      shared: sharedAnimData,
      durations: getAnimDurations(sharedAnimData, def.walkSpeed),
      initHeadWidth: spineMeta.head[headSkinName].packedHead.top.width,

      path: [],
      aux: {
        angs: [],
        edges: [],
        elens: [],
        index: 0,
        outsetSegBounds: new Rect,
        outsetWalkBounds: new Rect,
        // roomWalkBounds: new Rect,
        segBounds: new Rect,
        sofars: [],
        total: 0,
      },
      staticBounds: new Rect,
      staticPosition: new Vect,
      
      animName: 'idle',
      opacity: emptyAnimation,
      rotate: emptyAnimation,
      translate: emptyAnimation,
      
      doorStrategy: 'none',
      gmRoomIds: [],
      prevWayMetas: [],
      wayMetas: [],
      wayTimeoutId: 0,
    },

    doMeta: null,
    forcePaused: false,
    gmRoomId: null,
    has: { key: api.gmGraph.gms.map(_ => ({})) },
    navOpts: {
      centroidsFallback: true,
      closedWeight: 10 * 1000, // avoid closed doors (?)
    },
    navPath: null,
    nextWalk: null,
    unspawned: true,

    // 🚧 methods
  };
}

const emptyAnimation = anime({});

const sharedAnimData = /** @type {Record<NPC.SpineAnimName, NPC.SharedAnimData>} */ (
  {}
);

/**
 * @param {NPC.SpineAnimName} animName
 * @param {NPC.SpineAnimName} animName
 * @returns {NPC.SharedAnimData}
 */
function getSharedAnimData(animName) {
  const { headFrames, frameCount, rootDeltas, neckPositions } = spineMeta.anim[animName];
  return sharedAnimData[animName] ??= {
    animName,
    frameCount,
    bodyRects: spineMeta.anim[animName].packedRects,
    headFrames,
    neckPositions,
    rootDeltas,
    headOrientKey: spineAnimToSetup[animName].headOrientKey,
    stationaryFps: spineAnimToSetup[animName].stationaryFps,
  };
}

/**
 * 
 * @param {NPC.SharedAnimData} shared 
 * @param {number} walkSpeed
 */
function getAnimDurations(shared, walkSpeed) {
  if (shared.rootDeltas.length) {
    // rootDelta is in our world coords, where 60 ~ 1.5 meter (so 40 ~ 1 meter)
    return shared.rootDeltas.map(delta => (delta / 40) / walkSpeed);
  } else {
    return [...Array(shared.frameCount)].map(_ => 1 / shared.stationaryFps);
  }
}
