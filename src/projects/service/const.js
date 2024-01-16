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
  articleOverlay: 'article-overlay',
  carouselLabelHeight: '--carousel-label-height',
  central: 'central',
  clear: 'clear',
  copyJustFailed: 'copy-just-failed',
  disableIcon: 'disable-icon',
  disabled: 'disabled',
  expanded: 'expanded',
  enabled: 'enabled',
  faded: 'faded',
  horizontalFill: 'horizontal-fill',
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
  navArrow: 'nav-arrow',
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

export const longClickMs = 300;

/** Decimal place precision */
export const precision = 4;

//#region npcs

/**
 * Hull doors need to intersect exactly one room.
 * > `2 + 8 + 2` is `12` which is original geomorph hull door width.
 */
export const hullDoorOutset = 2;

/**
 * Removing this outset breaks navigation,
 * e.g. walls of geomorph 301 are no longer connected.
 */
export const hullOutset = 2;

export const wallOutset = 14;

export const obstacleOutset = 13;

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

/** For quick nav node lookup */
export const navNodeGridSize = 60 / 2;

export const roomGridSize = 60;

export const decorGridSize = 60 * 2;

/** @type {Record<NPC.DecorPointClassKey, { width: number; height?: number }>} */
export const decorSheetSetup = {
  'circle-right': { width: 64, height: 64 },
  'info': { width: 64, height: 64 },
  'lying-man': { width: 64, height: 64 },
  'road-works': { width: 64, height: 64 },
  'sitting-man': { width: 64, height: 64 },
  'standing-man': { width: 64, height: 64 },

  'computer-1': { width: 256 },
  'computer-2': { width: 128 },
 };

/**
 * Height of an edge geomorph.
 */
export const gmGridSize = 600;

export const ansi = {
  Black: '\x1b[30m',
  Blue: '\x1b[1;34m',
  Bold: '\x1b[1m',
  BoldReset: '\x1b[22m',
  BrightGreen: '\x1b[92m',
  BrightGreenBg: '\x1b[102m\x1b[30m',
  BrightYellow: '\x1b[93m',
  BrightWhite: '\x1b[97m',
  Cyan: '\x1b[96m',
  DarkGreen: '\x1b[32m',
  DarkGrey: '\x1b[90m',
  GreyBg: '\x1b[47m',
  DarkGreyBg: '\x1b[100m',
  Purple: '\x1b[35m',
  Red: '\x1b[31;1m',
  Reverse: '\x1b[7m',
  ReverseReset: '\x1b[27m',
  Reset: '\x1b[0m',
  // Strikethrough: '\x1b[9m',
  // Warn: '\x1b[30;104m',
  // White: '\x1b[0;37m',
  White: '\x1b[37m',
  Underline: '\x1b[4m',
  UnderlineReset: '\x1b[24m',
};

export const EOF = Symbol.for('EOF');
