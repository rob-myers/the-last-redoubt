export const cssName = /** @type {const} */ ({
  door: 'door',
  doors: 'doors',
  doorTouchUi: 'door-touch-ui',
  iris: 'iris',
  hull: 'hull',
  open: 'open',
  locked: 'locked',

  debugDoorArrowPtrEvts: '--debug-door-arrow-ptr-evts',
  debugGeomorphOutlineDisplay: '--debug-gm-outline-display',
  debugHighlightWindows: '--debug-highlight-windows',
  debugRoomNavDisplay: '--debug-room-nav-display',
  debugRoomOutlineDisplay: '--debug-room-outline-display',
  debugShowIds: '--debug-show-ids',
  debugShowLabels: '--debug-show-labels',
  // ...

  decorCircle: 'decor-circle',
  decorGroup: 'decor-group',
  decorGroupHandle: 'decor-group-handle',
  decorPath: 'decor-path',
  decorPathPoint: 'decor-path-point',
  decorPoint: 'decor-point',
  decorRect: 'decor-rect',
  decorCollidersDisplay: '--decor-colliders-display',
  decorIconWidth: '--decor-icon-width',
  decorPathColour: '--decor-path-colour',
  
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
});

export const defaultClipPath = 'none';

export const defaultDoorCloseMs = 7000;

/** @type {NPC.NpcClassKey} */
// export const defaultNpcClassKey = 'first-human-npc';
// export const defaultNpcClassKey = 'solomani';
export const defaultNpcClassKey = 'vilani';
// export const defaultNpcClassKey = 'zhodani';

export const defaultNpcInteractRadius = 70;

/** `24 / 5` because we scale down SVG symbols */
export const doorWidth = 4.8;

/** HMR note: use of WAPI means anim must be retriggered  */
export const geomorphMapFilterShown = 'invert(100%) brightness(35%) contrast(120%)';
export const geomorphMapFilterHidden = 'invert(100%) brightness(0%) contrast(120%)';

/** Keep hull doors thin */
export const hullDoorWidth = 8;

/** HMR note: WAPI means anim must be retriggered  */
export const obscuredNpcOpacity = 0.25;

/**
 * We avoid directly importing for better React HMR.
 * @type {import('projects/service/const').preDarkenCssRgba}
 */
export const preDarkenCssRgba = 'rgba(0, 0, 0, 0.3)';

export const spawnFadeMs = 500;

/**
 * We avoid directly importing for better React HMR.
 * @type {import('projects/service/const').wallOutset}
 */
export const wallOutset = 12;
