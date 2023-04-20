export const siteTitle = 'NPC CLI';

export const discussionsUrl = "https://github.com/rob-myers/the-last-redoubt/discussions";

export const localStorageKey = {
  darkModeEnabled: 'dark-mode-enabled',
  windowScrollY: 'window-scroll-y',
};

export const cssName = /** @type {const} */ ({
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
  decorPath: 'decor-path',
  decorPoint: 'decor-point',
  decorRect: 'decor-rect',
  decorIconWidth: '--decor-icon-width',
  decorPathColour: '--decor-path-colour',
  
  geomorphFilter: '--geomorph-filter',
  geomorphDarkFilter: '--geomorph-dark-filter',

  npc: 'npc',
  npcBody: 'body',
  npcsDebugDisplay: '--npcs-debug-display',
  npcDoorTouchRadius: '--npc-door-touch-radius',
  npcsInteractRadius: '--npcs-interact-radius',
  npcBoundsRadius: '--npc-bounds-radius',
  npcHeadRadius: '--npc-head-radius',
  //#endregion
});

export const zIndex = /** @type {const} */ ({
  nav: 11,
  navMini: 10,
  navTopBar: 7,
  tabsExpandedBackdrop: 19,
  tabsExpanded: 20,
  tabsTopRightButtons: 2,
  tabsCentralButton: 6,
  tabsFaderOverlay: 4,
  ttyTouchHelper: 5,
});

export const cssTimeMs = /** @type {const} */ ({
  justCopied: 1000,
});

/** Decimal place precision */
export const precision = 4;

//#region npcs

/** `24 / 5` because we scale down SVG symbols */
export const doorWidth = 4.8;

/** Keep hull doors thin */
export const hullDoorWidth = 8;
/** Hull doors need to intersect exactly one room */
export const hullDoorOutset = 2;

/**
 * Removing this outset breaks navigation,
 * e.g. walls of geomorph 301 are no longer connected.
 */
export const hullOutset = 2;

export const wallOutset = 15;

export const obstacleOutset = 10;

export const lightDoorOffset = 40;

export const lightWindowOffset = 20;

export const defaultDoorCloseMs = 7000;

export const defaultNpcInteractRadius = 50;

/** @type {NPC.NpcClassKey} */
// export const defaultNpcClassKey = 'first-human-npc';
export const defaultNpcClassKey = 'vilani-a';
// export const defaultNpcClassKey = 'zhodani-a';

export const spawnFadeMs = 500;

//#endregion

export const svgSymbolTag = /** @type {const} */ ({
  /** View positions associated to a single door */
  view: 'view',
  /** Light positions inside geomorph */
  light: 'light',
});

export const defaultLightDistance = 300;

export const distanceTagRegex = /^distance-(\d+)$/;

/** For lighting we initially darken everything */
export const preDarkenCssRgba = 'rgba(0, 0, 0, 0.3)';
