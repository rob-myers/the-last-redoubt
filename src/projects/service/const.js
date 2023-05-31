export const siteTitle = 'NPC CLI';

export const discussionsUrl = "https://github.com/rob-myers/the-last-redoubt/discussions";

export const localStorageKey = {
  darkModeEnabled: 'dark-mode-enabled',
  touchTtyCanType: 'touch-tty-can-type',
  touchTtyOpen: 'touch-tty-open',
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

/** Hull doors need to intersect exactly one room */
export const hullDoorOutset = 2;

/**
 * Removing this outset breaks navigation,
 * e.g. walls of geomorph 301 are no longer connected.
 */
export const hullOutset = 2;

export const wallOutset = 12;

export const obstacleOutset = 8;

export const lightDoorOffset = 40;

export const lightWindowOffset = 20;

/**
 * One grid square corresponds to 1.5 meters according to Starship Geomorphs 2.0.
 * In our approach, one grid square is 60 world units square.
 * Average male shoulder width is 41cms (from above).
 * Choosing 65cms (to include arms) then:
 * ```
 * 2 * radius is (0.65/1.5) * 60 = 26 world units
 * hence radius is 13
 * ```
 */
// export const npcRadius =  14.4;
// export const npcWorldRadius =  10;
export const npcWorldRadius =  13;

//#endregion

export const svgSymbolTag = /** @type {const} */ ({
  /** View positions associated to a single door */
  view: 'view',
  /** Light positions or circular/poly/rect floor-lights */
  light: 'light',
  /** Distinguish lights as floor-lights */
  floor: 'floor',
  /** Surfaces can obscure NPC legs when sitting */
  surface: 'surface',
});

export const defaultLightDistance = 300;

/** For lighting we initially darken everything */
export const preDarkenCssRgba = 'rgba(0, 0, 0, 0.3)';
