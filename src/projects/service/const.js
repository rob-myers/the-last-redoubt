/**
 * 👋 `yarn types` to check projects/world/const.js mirrored changes
 */

export const siteTitle = 'NPC CLI';

export const discussionsUrl = "https://github.com/rob-myers/the-last-redoubt/discussions";

export const localStorageKey = {
  darkModeEnabled: 'dark-mode-enabled',
  touchTtyCanType: 'touch-tty-can-type',
  touchTtyOpen: 'touch-tty-open',
  windowScrollY: 'window-scroll-y',
};

export const cssName = /** @type {const} */ ({
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
  /** Light positions or circular/poly/rect floor-lights */
  light: 'light',
  /** Distinguish lights as floor-lights */
  floor: 'floor',
  /** Relate parallel doors to prevent view extending through closed doors */
  'parallel-connectors': 'parallel-connectors',
  /** Relate doors to doors/windows to extend view */
  'relate-connectors': 'relate-connectors',
  /** Surfaces can obscure NPC legs when sitting */
  surface: 'surface',
  /** View positions associated to a single door */
  view: 'view',
});

export const defaultLightDistance = 300;

/** For lighting we initially darken everything */
export const preDarkenCssRgba = 'rgba(0, 0, 0, 0.3)';

/** For quick nav node lookup */
export const navNodeGridSize = 60 / 2;

export const decorGridSize = 60 * 2;
