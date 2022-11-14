export const siteTitle = 'NPC CLI';

export const discussionsUrl = "https://github.com/rob-myers/the-last-redoubt/discussions";

export const localStorageKey = {
  darkModeEnabled: 'dark-mode-enabled',
  windowScrollY: 'window-scroll-y',
};

export const cssName = {
  anchor: 'anchor',
  central: 'central',
  clear: 'clear',
  copyJustFailed: 'copy-just-failed',
  disableIcon: 'disable-icon',
  disabled: 'disabled',
  expanded: 'expanded',
  door: 'door',
  doors: 'doors',
  doorTouchUi: 'door-touch-ui',
  enabled: 'enabled',
  faded: 'faded',
  hull: 'hull',
  ignoreDark: 'ignore-dark',
  infoIcon: 'info-icon',
  iris: 'iris',
  justCopied: 'just-copied',
  navMain: 'nav-main',
  navMainOpen: 'open',
  navMainClosed: 'closed',
  navMini: 'nav-mini',
  nextArticle: 'next-article',

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
  decorSeg: 'decor-seg',
  
  npc: 'npc',
  npcBody: 'body',
  npcsDebugDisplay: '--npcs-debug-display',
  npcsInteractRadius: '--npcs-interact-radius',
  npcBoundsRadius: '--npc-bounds-radius',
  /**
   * Angle of body when last idle e.g. `0rad`. Carries additional info,
   * i.e. modulus of `2 * Math.PI`, ensuring we turn the smaller angle.
   */
  npcLookRadians: '--npc-look-radians',

  open: 'open',
  resetIcon: 'reset-icon',
  tabs: 'tabs',
  tabsExpandedMaxWidth: '--tabs-expanded-max-width',
  topBar: 'top-bar',
  topBarHandle: 'handle',
  topRight: 'top-right',
} as const;

export const zIndex = {
  nav: 11,
  navMini: 10,
  navTopBar: 7,
  tabsExpandedBackdrop: 19,
  tabsExpanded: 20,
  tabsTopRightButtons: 2,
  tabsCentralButton: 6,
  tabsFaderOverlay: 4,
  ttyTouchHelper: 5,
} as const;

export const cssTimeMs = {
  justCopied: 1000,
} as const;

/** Decimal place precision */
export const precision = 4;

//#region npcs

/** `24 / 5` because we scale down SVG symbols */
export const doorWidth = 4.8;

export const hullDoorWidth = 12;

/**
 * Removing this outset breaks navigation,
 * e.g. walls of geomorph 301 are no longer connected.
 */
export const hullOutset = 2;

export const wallOutset = 15;

export const obstacleOutset = 10;

export const lightDoorOffset = 40;

export const lightWindowOffset = 20;

//#endregion