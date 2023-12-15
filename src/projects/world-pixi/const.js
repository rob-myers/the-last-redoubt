import { ColorMatrixFilter } from "@pixi/filter-color-matrix";
import { TextStyle } from "@pixi/text";
import { keys } from "../service/generic";

//#region pixi

export const colMatFilter1 = new ColorMatrixFilter();
// colorMatrixFilter.resolution = window.devicePixelRatio;
colMatFilter1.resolution = 4; // ℹ️ no zoom flicker
// colorMatrixFilter.enabled = true;
// colMatFilter1.polaroid(true);
colMatFilter1.brightness(0.18, true);
colMatFilter1.contrast(1.5, true);
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
colMatFilter3.brightness(0.2, true);

export const textStyle1 = new TextStyle({
  fontFamily: 'Gill sans',
  letterSpacing: 1,
  fontSize: 8,
  // textBaseline: 'bottom',
  // fontStyle: 'italic',
  // fontWeight: 'bold',
  fill: ['#ffffff'],
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


//#region spine

/** @type {Record<NPC.SpineHeadSkinName, true>} */
const fromSpineHeadSkinName = { "head/blonde-light": true, "head/skin-head-dark": true, "head/skin-head-light": true };

export const spineHeadSkinNames = keys(fromSpineHeadSkinName);

/** @type {Record<NPC.SpineAnimName, true>} */
const fromSpineAnimName = { "idle": true, "idle-breathe": true, "lie": true, "sit": true, "walk": true };

export const spineAnimNames = keys(fromSpineAnimName);

/** @type {Record<NPC.SpineHeadOrientKey, NPC.SpineHeadOrient>} */
const toSpineHeadOrient = {
  face: { headOrientKey: 'top', animName: 'idle', headAttachmentName: 'head', hairAttachmentName: 'hair' },
  top: { headOrientKey: 'face', animName: 'lie', headAttachmentName: 'head-lie', hairAttachmentName: 'hair-lie' },
};

export const spineHeadOrients = Object.values(toSpineHeadOrient);

/** @type {Record<NPC.SpineAnimName, number>} */
export const spineAnimToFrames = {
  idle: 1,
  sit: 1,
  lie: 1,
  "idle-breathe": 20,
  walk: 20,
};

/** @type {Record<NPC.SpineAnimName, NPC.SpineHeadOrientKey>} */
export const spineAnimToHeadOrient = {
  idle: 'top',
  sit: 'top',
  lie: 'face',
  "idle-breathe": 'top',
  walk: 'top',
};

//#endregion