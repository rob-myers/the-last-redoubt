/**
 * For React HMR we distinguish from projects/service/const.js.
 * Sometimes we must duplicate; we ensure the same values via types.
 */

/** @type {typeof import('projects/service/const').cssName} */
export const cssName = {
  //#region site
  anchor: 'anchor',
  carouselLabelHeight: '--carousel-label-height',
  central: 'central',
  clear: 'clear',
  copyJustFailed: 'copy-just-failed',
  disableIcon: 'disable-icon',
  disabled: 'disabled',
  expanded: 'expanded',
  enabled: 'enabled',
  faded: 'faded',
  /** see icons.css */
  iconSizeBase: '--icon-size-base',
  /** see icons.css */
  iconSizeLarge: '--icon-size-large',
  /** see icons.css */
  iconSizeSmall: '--icon-size-small',
  /** see icons.css */
  iconSizeTiny: '--icon-size-tiny',
  ignoreDark: 'ignore-dark',
  infoIcon: 'info-icon',
  justCopied: 'just-copied',
  navMain: 'nav-main',
  navMainOpen: 'open',
  navMainClosed: 'closed',
  navMini: 'nav-mini',
  nextArticle: 'next-article',
  resetIcon: 'reset-icon',
  tabs: 'tabs',
  tabsExpandedMaxWidth: '--tabs-expanded-max-width',
  topBar: 'top-bar',
  topBarHandle: 'handle',
  topRight: 'top-right',
  //#endregion

  //#region world
  door: 'door',
  doors: 'doors',
  doorTouchUi: 'door-touch-ui',
  iris: 'iris',
  hull: 'hull',
  open: 'open',

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
  decorPath: 'decor-path',
  decorPathPoint: 'decor-path-point',
  decorPoint: 'decor-point',
  decorRect: 'decor-rect',
  decorIconWidth: '--decor-icon-width',
  decorPathColour: '--decor-path-colour',
  
  geomorphFilter: '--geomorph-filter',
  geomorphMapFilter: '--geomorph-map-filter',
  geomorphLabelsOpacity: '--geomorph-labels-opacity',

  npc: 'npc',
  npcBody: 'body',
  npcsDebugDisplay: '--npcs-debug-display',
  npcsDebugPlayerDisplay: '--npcs-debug-player-display',
  npcDoorTouchRadius: '--npc-door-touch-radius',
  npcsInteractRadius: '--npcs-interact-radius',
  npcBoundsRadius: '--npc-bounds-radius',
  npcHeadRadius: '--npc-head-radius',
  //#endregion
};

export const defaultClipPath = 'none';

export const defaultDoorCloseMs = 7000;

/** @type {NPC.NpcClassKey} */
// export const defaultNpcClassKey = 'first-human-npc';
export const defaultNpcClassKey = 'vilani-a';
// export const defaultNpcClassKey = 'zhodani-a';

export const defaultNpcInteractRadius = 70;

/** `24 / 5` because we scale down SVG symbols */
export const doorWidth = 4.8;

/** HMR note: use of WAPI means anim must be retriggered  */
export const geomorphMapFilterShown = 'invert(100%) brightness(40%) contrast(120%)';
export const geomorphMapFilterHidden = 'invert(100%) brightness(0%) contrast(120%)';

/** Keep hull doors thin */
export const hullDoorWidth = 8;

/** HMR note: WAPI means anim must be retriggered  */
export const obscuredNpcOpacity = 0.25;

/** @type {import('projects/service/const').preDarkenCssRgba} */
export const preDarkenCssRgba = 'rgba(0, 0, 0, 0.3)';

export const spawnFadeMs = 500;

/** @type {import('projects/service/const').wallOutset} */
export const wallOutset = 12;
