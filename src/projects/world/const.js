import { isSmallViewport } from '../service/dom';

export const cssName = /** @type {const} */ ({
  door: 'door',
  doors: 'doors',
  doorTouchUi: 'door-touch-ui',
  iris: 'iris',
  hull: 'hull',
  open: 'open',
  locked: 'locked',

  /** 🤔 unused due to type error when: `${cssName.geomorphFilter}: ${geomorphFilter}` */
  geomorphFilter: '--geomorph-filter',
  geomorphMapFilter: '--geomorph-map-filter',
  geomorphLabelsOpacity: '--geomorph-labels-opacity',

  /** see icons.css */
  iconSizeTiny: '--icon-size-tiny',

  npc: 'npc',
  npcBody: 'body',
  npcsDebugDisplay: '--npcs-debug-display',
  npcsDebugPlayerDisplay: '--npcs-debug-player-display',
  npcDoorTouchRadius: '--npc-door-touch-radius',
  npcsInteractRadius: '--npcs-interact-radius',
  npcBoundsRadius: '--npc-bounds-radius',
  npcHeadRadius: '--npc-head-radius',
  forcePaused: 'force-paused',
  paused: 'paused',
});

export const defaultClipPath = 'none';

export const defaultDoorCloseMs = 7000;

/** @type {NPC.NpcClassKey} */
// export const defaultNpcClassKey = 'solomani';
export const defaultNpcClassKey = 'vilani';
// export const defaultNpcClassKey = 'zhodani';

export const defaultNpcInteractRadius = 70;

export const npcFastWalkSpeedFactor = 1;
export const npcWalkSpeedFactor = 0.7;
export const npcSlowWalkSpeedFactor = 0.5;
/** Now larger for mobile 🤔 maybe can change? */
export const npcHeadRadiusPx = 10;

/** `24 / 5` because we scale down SVG symbols */
export const doorWidth = 4.8;

// export const geomorphFilter = 'brightness(50%) sepia(0.1) contrast(1.3)';
export const geomorphFilter = 'brightness(50%) hue-rotate(0deg) sepia(0.1) contrast(1.2)';

/** HMR note: use of WAPI means anim must be retriggered  */
export const geomorphMapFilterShown = 'invert(100%) brightness(35%) contrast(120%)';
export const geomorphMapFilterHidden = 'invert(100%) brightness(0%) contrast(120%)';

/** HMR note: WAPI means anim must be retriggered  */
export const obscuredNpcOpacity = 0.25;

export const preDarkenCssRgba = 'rgba(0, 0, 0, 0.3)';

export const spawnFadeMs = 500;

/**
 * We avoid directly importing for better React HMR.
 * @type {import('projects/service/const').wallOutset}
 */
export const wallOutset = 12;

export const doorSensorRadius = 30;

export const doorViewOffset = -2;

export const windowViewOffset = 20;

export const baseTrackingZoom = isSmallViewport() ? 1 : 1.5;

/**
 * Geomorph scale factor i.e.
 * how much we scale images up by to improve quality on zoom.
 */
export const gmScale = 2.5;

export const decorIconRadius = 4;

/**
 * Each value is an integer in [0, 255]
 */
export const hitTestRed = {
  /** rgba encoding `(255, 0, doorId, 1)` */
  door: 255,
  /** rgba encoding `(254, roomId, decorPointId, 1)` */
  decorPoint: 254,
  /** rgba encoding `(253, roomId, doorId, 1)` */
  debugArrow: 253,
  /** rgba encoding `(0, roomId, 255, 0.1)` */
  room: 0,
};

export const debugDoorOffset = 10;

export const skeletonScale = 0.1;
