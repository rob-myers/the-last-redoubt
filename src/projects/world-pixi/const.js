import { ColorMatrixFilter } from "@pixi/filter-color-matrix";
import { TextStyle } from "@pixi/text";
import { keys } from "../service/generic";

export const worldUnitsPerMeter = 40;

//#region pixi

export const colMatFilter1 = new ColorMatrixFilter();
// colorMatrixFilter.resolution = window.devicePixelRatio;
colMatFilter1.resolution = 4; // ℹ️ no zoom flicker
// colorMatrixFilter.enabled = true;
// colMatFilter1.polaroid(true);
colMatFilter1.brightness(0.18, true);
colMatFilter1.contrast(1, true);
// colMatFilter1.alpha = 1;
// colMatFilter1.hue(90, true);
// colMatFilter1.vintage(true);
// colMatFilter1.kodachrome(true);

export const colMatFilter2 = new ColorMatrixFilter();
colMatFilter2.alpha = 0.2;
// colMatFilter2.tint(0, true);
colMatFilter2.resolution = 2; // better zoom flicker

export const colMatFilter3 = new ColorMatrixFilter();
// colMatFilter3.resolution = 2; // better zoom flicker
// colMatFilter3.kodachrome(true);
colMatFilter3.brightness(0.15, true);

export const textStyle1 = new TextStyle({
  fontFamily: 'Gill sans',
  letterSpacing: 1,
  fontSize: 8,
  // textBaseline: 'bottom',
  // fontStyle: 'italic',
  // fontWeight: 'bold',
  fill: ['#888888'],
  stroke: '#000000',
  strokeThickness: 2,
  dropShadow: false,
  dropShadowColor: '#000000',
  dropShadowBlur: 4,
  dropShadowAngle: Math.PI / 6,
  dropShadowDistance: 6,
  wordWrap: true,
  wordWrapWidth: 440,
  lineJoin: 'round',
});

//#endregion

//#region npc

/** @type {NPC.NpcClassKey} */
export const defaultNpcClassKey = 'vilani';
export const defaultNpcInteractRadius = 120;
/** World units per second */
export const defaultNpcSpeed = 1 * worldUnitsPerMeter;

export const npcRadius = 14;

//#endregion

//#region spine

/** @type {Record<NPC.SpineHeadSkinName, true>} */
const fromSpineHeadSkinName = { "head/blonde-light": true, "head/skin-head-dark": true, "head/skin-head-light": true };

export const spineHeadSkinNames = keys(fromSpineHeadSkinName);

/** @type {Record<NPC.SpineHeadOrientKey, NPC.SpineHeadOrientMapping>} */
const toSpineHeadOrient = {
  face: { headOrientKey: 'top', animName: 'idle', headAttachmentName: 'head', hairAttachmentName: 'hair' },
  top: { headOrientKey: 'face', animName: 'lie', headAttachmentName: 'head-lie', hairAttachmentName: 'hair-lie' },
};

export const spineHeadOrients = Object.values(toSpineHeadOrient);

/** @type {Record<NPC.SpineAnimName, NPC.SpineAnimSetup>} */
export const spineAnimSetup = {
  idle: { animName: 'idle', numFrames: 1, headOrientKey: 'top', stationaryFps: 0 },
  "idle-breathe": { animName: 'idle-breathe', numFrames: 20, headOrientKey: 'top', stationaryFps: 10 },
  "idle-straight": { animName: 'idle-straight', numFrames: 1, headOrientKey: 'top', stationaryFps: 0 },
  sit: { animName: 'sit', numFrames: 1, headOrientKey: 'top', stationaryFps: 0 },
  "straight-to-idle": { animName: 'straight-to-idle', numFrames: 10, headOrientKey: 'top', stationaryFps: 30 },
  lie: { animName: 'lie', numFrames: 1, headOrientKey: 'face', stationaryFps: 0 },
  walk: { animName: 'walk', numFrames: 30, headOrientKey: 'top', stationaryFps: 20 },
};

export const spineAnimNames = keys(spineAnimSetup);

/** @type {Record<NPC.NpcClassKey, NPC.SpineHeadSkinName>} */
export const npcClassToSpineHeadSkin = {
  solomani: 'head/blonde-light',
  vilani: 'head/skin-head-light',
  zhodani: 'head/skin-head-dark',
};

export const spineShadowOutset = 8;

//#endregion
