declare namespace NPC {

  //#region individual npc

  /**
   * - Corresponds to media/NPC/class/{key}/{key}--{animKey}.png
   * - Corresponds to static/assets/npc/{key}/{key}--{animKey}.png
   * - Instantiated npcs are identified by their npcKey,
   *   whereas npcClassKey corresponds to their "character class".
   */
  type NpcClassKey = (
    | 'solomani'
    | 'vilani'
    | 'zhodani'
  );

  interface NpcClassJson {
    classKey: NpcClassKey;
    parsed: NPC.ParsedNpc;
    scale: number;
    radius: number;
    speed: number;
    /** @emotion/css */
    css: string;
  }

  /** API for a single NPC */
  export interface NPC {
    /** User specified e.g. `rob` */
    key: string;
    /** Refers to `static/assets/npc/{classKey}/{classKey}.json` */
    classKey: NPC.NpcClassKey;
    /** Epoch ms when spawned */
    epochMs: number;
    /** Definition of NPC */
    def: NPCDef;

    //#region top-level anim

    /** Track - there is one for each animation e.g. `walk` */
    tr: Track;
    turn: {
      /** Lerp aggregation in [0, 1] */
      agg: number;
      dstDeg: number;
      /** Index in path we are turning towards */
      dstNodeId: number;
    };
    /**
     * Data derived from `a.path`.
     * However, `outsetWalkBounds` and `outsetSegBounds` depend on npc radius.
     */
    aux: {
      /** Radians, aligned to `edges` */
      angs: number[];
      /** Outgoing edges `path[i] -> path[i+1]` */
      edges: Geom.Vect[];
      /** Aligned to `edges` i.e. length of outgoing edges */
      elens: number[];
      /** Last seen index of path */
      index: number;
      /** Outset by npc radius, for npc vs npc collisions */
      outsetWalkBounds: Geom.Rect;
      /** Outset by npc radius, for npc vs npc collisions */
      outsetSegBounds: Geom.Rect;
      /** For npc vs decor collisions */
      segBounds: Geom.Rect;
      /** Distance travelled when at respective node, hence `sofars[0]` is `0`  */
      sofars: number[];
      /** Length of path */
      total: number;
    };

    /** Frame durations (secs), aligned to @see tr length */
    frameDurs: number[];
    /** Frame pointer: index of @see frameMap */
    framePtr: number;
    /** Track frames i.e. 0-based frames less than @see tr length */
    frameMap: number[];
    /**
     * Invoked on finish transition.
     * Non-`null` iff a transition is in progress.
     */
    resolveTransition: null | (() => void);

    animName: SpineAnimName;
    /** Induced by @see time @see framePtr @see frameMap */
    frame: number;
    /** Total distance travelled since animation began (world units). */
    distance: number;
    /** Degrees */
    neckAngle: number;
    /** Has npc `started-walking` but hasn't `stopped-walking` yet? */
    pendingWalk: boolean;
    /**
     * SpriteSheet-normalized time.
     * - starts from `0` when animation begins
     * - non-negative integers correspond to frames
     * - actual time between increments follows from @see frameDurs
     */
    time: number;
    /** Invoked on walk cancel */
    walkCancel: (err: Error) => void;
    /** Invoked on walk finish */
    walkFinish: () => void;
    /** Initially `npc.def.walkSpeed` */
    walkSpeed: number;
    
    //#endregion


    el: {// 🚧 old
      root: HTMLDivElement;
      body: HTMLDivElement;
    };
    /** Sprites */
    s: {
      body: import('pixi.js').Sprite;
      head: import('pixi.js').Sprite;
      bounds?: import('pixi.js').Sprite;
    };

    anim: NPCAnimData; // 🚧 old
    a: AnimData; 

    /** Number of times we have cancelled */
    cancelCount: number;
    /** From current do point */
    doMeta: null | Geomorph.PointMeta;
    /**
     * _Background_: Process suspend/resume can pause/resume npc.
     * If not resumed, such pausing will be overridden by next npc action.
     * 
     * We can also _intentionally_ pause by invoking npc.pause(),
     * in which case we have "forced" a pause, until we resume it.
     */
    forcePaused: boolean;
    /**
     * Set on spawn or at vertex during walk.
     * Can be `null` e.g. if spawned into doorway, or outside map.
     * While walking, doorways will default to previously entered room.
     */
    gmRoomId: null | Geomorph.GmRoomId;
    /** Inventory */
    has: {
      /** has key iff `doorKey[gmId][doorId]` is true */
      key: { [doorId: number]: boolean }[];
    };
    navOpts: NPC.NavOpts;
    /** Current navigation path we're walking along. */
    navPath: null | NPC.GlobalNavPath;
    nextWalk: null | {
      /** Future points to visit after finishing current walk */
      visits: Geom.Vect[];
      /** Future navigation path induced by `visits` */
      navPath: NPC.GlobalNavPath;
    };
    paused: boolean;
    /**
     * Initially `false` until <NPC> sets it true.
     * May also set false for cached un-rendered.
     */
    unspawned: boolean;

    cancel(overridePaused?: boolean): Promise<void>;
    canLook(): boolean;
    changeClass(npcClassKey: NPC.NpcClassKey): void;
    /** Recompute anim aux based on current path. */
    computeAnimAux(): void;
    do(point: Geomorph.PointMaybeMeta, opts?: Pick<NpcDoDef, 'fadeOutMs' | 'extraParams'>): Promise<void>;
    /** Filter pending way metas e.g. stale collisions. */
    filterWayMetas(
      shouldRemove: (meta: NPC.NpcWayMeta) => boolean
    ): void;
    clearWayMetas(): void;
    /**
     * This is `anim.aux.sofars[navMeta.index]`, except
     * `at-door` which is larger i.e. closer towards door.
     */
    computeWayMetaLength(navMeta: NPC.GlobalNavMeta): number;
    everWalked(): boolean;
    extendNextWalk(...points: Geom.VectJson[]): void;
    async fadeSpawn(point: Geomorph.PointMaybeMeta, opts?: {
      angle?: number;
      fadeOutMs?: number;
      meta?: Geomorph.PointMeta;
      npcClassKey?: NPC.NpcClassKey;
      requireNav?: boolean;
    }): Promise<void>;
    followNavPath(
      globalNavPath: NPC.GlobalNavPath,
      doorStrategy?: WalkDoorStrategy,
    ): Promise<void>;
    /** Radians in `[-π, +π]` */
    getAngle(): number;
    getWalkAnimDef(): NpcAnimDef;
    /**
     * - Used to scale up how long it takes to move along navpath.
     * - Converts world units to ms elapsed.
     */
    getAnimScaleFactor(): number;
    getHeadSkinRect(): Geom.RectJson;
    getInteractRadius(): number;
    getLineSeg(): null | NpcLineSeg;
    getNextDoorId(): number | undefined;
    getPath(): Geom.Vect[];
    getPosition(useCache?: boolean): Geom.Vect;
    getPrevDoorId(): number | undefined;
    getRadius(): number;
    /**
     * Walking speed in world units per second.
     */
    getSpeed(): number;
    getStaticBounds(): Geom.Rect;
    /**
     * We want to avoid flicker when the NPC stops walking e.g.
     * the leg should not be extended. Observe that
     * @see {NPC.NPC.anim.sprites} has infinite iterations,
     * so we need to augment the duration of a single walk cycle.
     * Assume:
     * - walk cycle starts from "idle position".
     * - half way is another "idle position".
     */
    getWalkCycleDuration(entireWalkMs: number): number;
    getTarget(): null | Geom.Vect;
    getTargets(): Geom.Vect[];
    getWalkBounds(): Geom.Rect;
    getWalkCurrentTime(): number | null;
    getWalkSegBounds(withNpcRadius: boolean): Geom.Rect;
    hasDoorKey(gmId: number, doorId: number): boolean;
    /**
     * Given npc is walking and anim.transform.currentTime,
     * infer position and angle.
     * We originally needed this because hidden tabs had `display: none`,
     * but no longer need it because `visibility: hidden`.
     * Nevertheless we'll keep this computation handy.
     */
    inferWalkTransform(): { position: Geom.Vect; angle: number; }
    inFrustum(point: Geom.VectJson): boolean;
    /** Initialise using `def` on (re)spawn */
    initialize(): void;
    intersectsCircle(position: Geom.VectJson, radius: number): boolean;
    isBlockedByOthers(start: Geomorph.PointMaybeMeta, next?: Geom.VectJson): boolean;
    isIdle(): boolean;
    /** Is this npc paused, but not necessarily @see {forcePaused}? */
    isPaused(): boolean;
    isPlayer(): boolean;
    isWalking(requireMoving?: boolean): boolean;
    /** Returns destination angle in radians */
    lookAt(point: Geom.VectJson, opts?: {
      /** Max time in milliseconds to complete look */
      ms?: number;
      force?: boolean;
    }): Promise<void>;
    pause(dueToProcessSuspend?: boolean): void;
    resume(dueToProcessResume?: boolean): void;
    nextWayTimeout(): void;
    npcRef(el: HTMLDivElement | null): void;
    obscureBySurfaces(): void;
    /** Started off-mesh and clicked point */
    offMeshDoMeta(point: Geomorph.PointMaybeMeta, opts: { fadeOutMs?: number; suppressThrow?: boolean }): Promise<void>;
    /** Started on-mesh and clicked point */
    onMeshDoMeta(point: Geomorph.PointMaybeMeta, opts: { fadeOutMs?: number; suppressThrow?: boolean; preferSpawn?: boolean; }): Promise<void>;
    
    /** Setting null effectively reverts to default */
    setInteractRadius(radius: number | null): void;
    showBounds(shouldShow: boolean): void;
    startAnimation(spriteSheet: SpineAnimName): void;
    setupAnim(animName: SpineAnimName): void;
    setGmRoomId(gmRoomId: Geomorph.GmRoomId | null): void;
    startAnimationByMeta(meta: Geomorph.PointMeta): void;
    setSpeedFactor(speedFactor: number): void;
    setWalkSpeed(walkSpeed: number): void;
    animateOpacity(targetOpacity: number, durationMs: number, onlyBody?: boolean): Promise<void>;
    animateRotate(targetRadians: number, durationMs: number, throwOnCancel?: boolean): Promise<void>;
    awaitTransition(): Promise<void>;
    updateHead(): void;
    updateMotion(): void;
    /**
     * Invoke initially, or just after `enter-room`.
     * @param srcIndex Index of 1st vertex in room.
     */
    updateRoomWalkBounds(srcIndex: number): void;
    updateSprites(): void;
    updateStaticBounds(): void;
    /** Update `anim.aux.index` and `anim.aux.index.segBounds` */
    updateTime(deltaRatio: number): void;
    updateWalkSegBounds(index: number): void;
    updateWayMetas(): void;
    walk(navPath: NPC.GlobalNavPath | Geom.VectJson, opts?: NPC.WalkNpcOpts | undefined): Promise<void>;
    /** Transition animation from walking to idle */
    walkToIdle(): Promise<void>;
    wayTimeout(): void;
  }

  // 🚧 old
  interface NPCAnimData {
    /** Sprite sheet related CSS */
    css: string;
    /** The path we'll walk along */
    path: Geom.Vect[];
    /**
     * Data derived entirely from `anim.path`, although
     * `outsetBounds` and `outsetSegBounds` depend on npc radius.
     */
    aux: {
      angs: number[];
      edges: ({ p: Geom.Vect; q: Geom.Vect })[];
      elens: number[];
      /** Last seen index of path */
      index: number;
      // /** Outset version of `origPath` to detect progress on pause */
      // navPathPolys: Geom.Poly[];
      /** Outset by npc radius, for npc vs npc collisions */
      outsetWalkBounds: Geom.Rect;
      /** Outset by npc radius, for npc vs npc collisions */
      outsetSegBounds: Geom.Rect;
      /** 🚧 unused */
      roomWalkBounds: Geom.Rect;
      /** For npc vs decor collisions */
      segBounds: Geom.Rect;
      sofars: number[];
      total: number;
    };
    /**
     * Bounds when stationary.
     * Less accurate than bounds radius,
     * particularly when not rotated.
     */
    staticBounds: Geom.Rect;
    /**
     * Last static position.
     */
    staticPosition: Geom.Vect;

    spriteSheet: SpineAnimName;
    opacity: Animation;
    translate: Animation;
    rotate: Animation;
    sprites: Animation;
    durationMs: number;
    /** Normal walking pace speed factor */
    defaultSpeedFactor: number;
    /** Current speed factor */
    speedFactor: number;
    /**
     * Value of `this.animScaleFactor()` when walk animation is constructed.
     * Useful because even though we use playbackRate to modify speed, we can
     * e.g. compute how far along walk we are via currentTime / initAnimScaleFactor
     */
    initAnimScaleFactor: number;
    /**
     * - Seems `anim.updatePlaybackRate(...)` not recorded in `anim.playbackRate`,
     *   nor in `anim.effect.getTiming().playbackRate` or similar.
     * - We only update playback rate to change the walking rate.
     */
    updatedPlaybackRate: number;

    doorStrategy: WalkDoorStrategy;
    /** Only set when it changes, starting from `0` */
    gmRoomIds: { [vertexId: number]: Geomorph.GmRoomId };
    prevWayMetas: NpcWayMeta[];
    wayMetas: NpcWayMeta[];
    wayTimeoutId: number;
  }

  interface AnimData {
    /** Path for walking along */
    path: Geom.Vect[];
    /** Bounds when stationary. */
    staticBounds: Geom.Rect;

    opacity: TweenExt<import('pixi.js').Sprite | import('pixi.js').Sprite[]>;
    rotate: TweenExt<import('pixi.js').Sprite>;

    /** Depends on head skin */
    initHeadWidth: number;

    doorStrategy: WalkDoorStrategy;
    /** Only set when it changes, starting from `0` */
    gmRoomIds: { [vertexId: number]: Geomorph.GmRoomId };
    prevWayMetas: NpcWayMeta[];
    wayMetas: NpcWayMeta[];
  }
  
  interface Track {
    animName: string;
    /** Body rects in SpriteSheet, (length @see length )*/
    bodys: Geom.RectJson[];
    /** Root motion deltas  (length @see length )*/
    deltas: null | number[];
    /** Implicit head rects on body rects in SpriteSheet, (length @see length )*/
    heads: (Geom.RectJson & { angle: number; })[];
    /** Number of frames */
    length: number;
    /** Neck positions, (length @see length )*/
    necks: Geom.VectJson[];
  }

  /**
   * - `none`: do not try to open doors
   * - `open`: open doors, walking into closed locked ones
   * - `safeOpen`: open doors, stopping at inaccessible locked ones (open or closed)
   * - `forceOpen`: open doors, forcing them open (as if had skeleton key)
   */
  type WalkDoorStrategy = (
    | 'none'
    | 'open'
    | 'safeOpen'
    | 'forceOpen'
  );

  interface WalkNpcOpts {
    throwOnCancel?: boolean 
    doorStrategy?: WalkDoorStrategy;
  }

  interface NpcLineSeg {
    src: Geom.Vect;
    dst: Geom.Vect;
    tangent: Geom.Vect;
  }

  interface NpcAnimDef {
    translateKeyframes: Keyframe[];
    rotateKeyframes: Keyframe[];
    opts: KeyframeAnimationOptions & { duration: number };
  }

  interface NPCDef {
    /** e.g. `rob` */
    key: string;
    /** e.g. `solomani` which determines "head skin" */
    classKey: NpcClassKey;
    /** Radians */
    angle: number;
    position: Geom.VectJson;
    /** World units per second */
    walkSpeed: number;
  }

  interface NpcClassConfig {
    anim: Record<string, {
      durationMs: number;
      frameCount: number;
      speed: number;
      /** Rotate each frame by 0, 90, 180 or 270 degrees */
      rotateDeg?: 0 | 90 | 180 | 270;
      /** Shift frame index e.g. so start from idle position when walking */
      shiftFramesBy?: number;
      totalDist: number;
    }>;
    radius: number;
  }

  interface ParsedNpc {
    npcClassKey: NpcClassKey;
    animLookup: {
      [animName: string]: NpcAnimMeta;
    };
    radius: number;
  }

  interface NpcAnimMeta {
    animName: string;
    /** AABB of a single frame prior to applying rotateDeg */
    frameAabbOrig: Geom.RectJson;
    /** AABB of a single frame with `rotateDeg` applied */
    frameAabb: Geom.RectJson;
    frameCount: number;

    /**
     * Total distance walked e.g. during walk cycle,
     * e.g. by tracking non-stationary foot and summing over a walk-cycle.
     * - Did this for Synfig using specified contact points.
     * - Could do this for Spriter Pro, but haven't tried doing it yet.
     *   In the meantime we simply guess it for Spriter Pro.
     */
    totalDist: number;
    
    durationMs: number;
    pathPng: string;
    pathWebp: string;

    /** Rotate each frame by 0, 90, 180 or 270 degrees */
    rotateDeg?: 0 | 90 | 180 | 270;
    /** Shift frame index e.g. so start from idle position when walking */
    shiftFramesBy?: number;
  }

  //#endregion

  //#region config

  /**
   * ℹ️ Here "config" refers to `npc ...`, not just `npc config ...`
   * 🚧 clarify these types
   */
  interface NpcConfigOpts extends Partial<Record<ConfigBooleanKey, boolean>> {
    interactRadius?: number;
    /** Induced by e.g. `npc config debug` or `npc config debug colliders` */
    configKey?: string;
    /** Induced by e.g. `npc rm-decor myCircle` */
    decorKey?: string;
    lit?: boolean;
    mapAction?: string;
    /** Induced by e.g. `npc get rob` */
    npcKey?: string;
    extraParams?: any[];
    point?: Geomorph.PointMaybeMeta;
    /** Suppress all errors e.g. for loop like `foo | npc do`  */
    suppressThrow?: boolean;
    timeMs?: number;
    verbose?: boolean;
  }

  type ConfigBooleanKey = (
    | 'canClickArrows'
    | 'debug'
    | 'debugHit'
    | 'debugPlayer'
    | 'gmOutlines'
    | 'hideGms'
    | 'highlightWindows'
    | 'localColliders'
    | 'localNav'
    | 'localOutline'
    | 'logTags'
    | 'omnipresent'
    | 'scriptDoors'
    | 'colliders'
    | 'verbose'
  );

   /**
    * Using `action` instead of `key` to avoid name-collision.
    */
   export type NpcAction = (
    | { action: 'add-decor'; items: DecorDef[]; }
    | { action: 'config' | 'cfg'; } // get all
    | { action: 'config' | 'cfg'; configKey: string } // Possibly space-sep `ConfigBooleanKey`s
    | NpcActionConfigPartial
    | { action: 'decor'; } // get all
    | { action: 'decor'; } & (DecorDef | { decorKey: string })
    | { action: 'events'; }
    | { action: 'get'; } // get all
    | { action: 'get'; npcKey: string; selector?: string | ((npc: NPC.NPC) => any); extraArgs?: any[]; }
    | { action: 'light'; lit?: boolean; point: Geom.VectJson }
    | { action: 'map'; mapAction?: FovMapAction; timeMs?: number; }
    | { action: 'remove-decor' | 'rm-decor'; items?: string[]; regexStr?: string; decorKey?: string; }
    | { action: 'rm' | 'remove'; npcKey?: string; npcKeys?: string[]; }
    | { action: 'set-player'; npcKey?: string }
  );

  export type NpcActionConfigPartial =
    & { action: 'config'; interactRadius?: number; }
    & Partial<Record<ConfigBooleanKey, boolean>>;

  export interface NpcDoDef {
    npcKey: string;
    point: Geomorph.PointMaybeMeta;
    fadeOutMs?: number;
    extraParams?: any[];
  }

  export type NpcActionKey = NpcAction['action'];

  export type FovMapAction = (
    | 'show'
    | 'show-labels'
    | 'hide'
    | 'hide-labels'
    | 'show-for'
    | 'show-labels-for'
    | 'pause'
    | 'resume'
  );

  export type NPCsEvent = (
    | { key: 'decors-added'; decors: DecorDef[]; }
    | { key: 'decor-click'; decor: DecorDef; }
    | { key: 'decors-removed'; decors: DecorDef[]; }
    | { key: 'disabled' }
    | { key: 'enabled' }
    | { key: 'fov-changed'; gmRoomIds: Geomorph.GmRoomId[]; added: Geomorph.GmRoomId[]; removed: Geomorph.GmRoomId[] }
    | { key: 'npc-clicked'; npcKey: string; position: Geom.VectJson; isPlayer: boolean; }
    | { key: 'npc-internal'; npcKey: string; event: 'cancelled' | 'paused' | 'resumed' }
    | { key: 'removed-npc'; npcKey: string; }
    | { key: 'set-player'; npcKey: string | null; }
    | { key: 'spawned-npc'; npcKey: string; }
    | {
        key: 'started-walking';
        npcKey: string;
        navPath: NPC.GlobalNavPath;
        /** Started walking from current position? */
        continuous: boolean;
        /** Extends a previous walk? */
        extends: boolean;
      }
    | { key: 'stopped-walking'; npcKey: string; }
    | { key: 'changed-speed'; npcKey: string; prevSpeed: number; speed: number; }
    | { key: 'resumed-track'; npcKey: string; }
    | { key: 'set-verbose'; verbose: boolean; }
    | NPCsWayEvent
  );

  export type NPCsEventWithNpcKey = Extract<NPCsEvent, { npcKey: string | null }>;

  export interface NPCsWayEvent {
    key: 'way-point';
    npcKey: string;
    meta: NpcWayMeta;
  }

  //#endregion

  //#region nav
  /**
   * A path through the `FloorGraph` of some geomorph instance.
   * Global nav paths are obtained by stitching these together.
   */
  export interface LocalNavPath extends Graph.FloorGraphNavPath {
    key: 'local-nav';
    gmId: number;
  }

  /**
   * A path through the world i.e. all geomorph instances.
   */
  export interface GlobalNavPath {
    key: 'global-nav';
    /** Useful for creating `DecorPath`s */
    name?: string;
    path: Geom.VectJson[];
    /**
     * Aligned to edges of @see {path}
     * i.e. the nav node ids along each edge.
     */
    edgeNodeIds: number[][];
    navMetas: GlobalNavMeta[];
    /**
     * The gmRoomId of a vertex whenever it differs from previous.
     * - May include other vertexIds e.g. due to concatenation.
     * - Used to e.g. set npc.gmRoomId during walk.
     */
    gmRoomIds: { [vertexId: number]: Geomorph.GmRoomId };
  }

  /**
   * An `NpcWayMeta` is a `GlobalNavMeta` with a `length` along the navpath it'll trigger.
   * - `length` is naturally computed using existing npc anim computations.
   * - `length` may be earlier than distance along path to respective node,
   *    and may also depend on npc's radius. 🤔 shouldn't it be _later_?
   */
  export type NpcWayMeta = GlobalNavMeta & {
    /** Computed via `anim.sofars` */
    length: number;
  }

  export type NpcWayMetaEnterRoom = Extract<NPC.NpcWayMeta, { key: 'enter-room' }>
  export type NpcWayMetaExitRoom = Extract<NPC.NpcWayMeta, { key: 'exit-room' }>
  export type NpcWayMetaVertex = Extract<NPC.NpcWayMeta, { key: 'vertex' }>
  export type NpcWayMetaNpcsCollide = Extract<NPC.NpcWayMeta, { key: 'npcs-collide' }>
  export type NpcWayMetaDecorCollide = Extract<NPC.NpcWayMeta, { key: 'decor-collide' }>

  /**
   * A `GlobalNavMeta` is a `FloorGraphNavMeta` enriched with the id of the geomorph instance
   * it resides in. Used e.g. to trigger light change on enter-room via a hull door.
   */
  export type GlobalNavMeta = Graph.FloorGraphNavMeta & {
    gmId: number;
  }

  export interface NpcCollision {
    /**
     * Time when they'll collide,
     * - `iA + (seconds * speed) . tangentA`
     * - `iB + (seconds * speed) . tangentB`
     * 
     * where:
     * - `i{A,B}` are current positions
     * - `speed` in world-units per second
     */
    seconds: number;
    /** Distance from iA at which they will collide */
    distA: number;
    /** Distance from iB at which they will collide */
    distB: number;
  }

  export interface NavOpts {
    /**
     * Automatically provided specification of open/locked doors,
     * i.e. `api.doors.lookup[gmId]` for respective geomorph's `gmId`.
     */
    doorMeta?: import('../world/Doors').State['lookup'][*];
    /** Weight of door nodes whose door is closed */
    closedWeight?: number;
    /** Weight of door nodes whose door is locked */
    lockedWeight?: number;
    /**
     * Non-navigable points can fallback to nav-node with
     * closest centroid, possibly restricted by roomId.
     *
     * Have seen navPoly containment succeed whilst navTriangle containment fails.
     * This option is useful for such cases i.e. after "guarded" by navPoly.
     */
    centroidsFallback?: boolean | number;
  }

  //#endregion

  //#region shell

  export interface SessionCtxt {
    /** Session key */
    key: string;
    receiveMsgs: boolean;
    /** PIDs of processes which panzoom */
    panzoomPids: number[];
    // 🤔 npcKey -> related pids? for npc-wise pause/resume
  }

  export interface NpcProcessCtxt {
    npcKey: string;
    sessionKey: string;
    pid: number;
  }

  //#endregion

  //#region decor

  interface BaseDecor {
    key: string;
    meta: Geomorph.PointMeta<Geomorph.GmRoomId>;
    /** Epoch ms when last updated (overwritten) */
    updatedAt?: number;
    /** Decor key of parent, if exists */
    parentKey?: string;

    /** Can be provided when defining decor via CLI -- shorter than writing meta. */
    tags?: string[];
    /** Avoid recomputation for collisions */
    derivedPoly?: Geom.Poly;
    derivedBounds?: Geom.Rect;
  }

  export interface DecorPoint extends BaseDecor, Geom.VectJson {
    type: 'point';
  }

  export interface DecorCircle extends BaseDecor, Geom.Circle {
    type: 'circle';
  }
  
  export interface DecorRect extends BaseDecor, Geom.RectJson {
    type: 'rect';
    angle?: number;
  }
  
  export type DecorDef = (
    | DecorCircle
    | DecorPoint
    | DecorRect
  );

  /** Collidable but not necessarily "freely collidable" */
  export type DecorCollidable = NPC.DecorCircle | NPC.DecorRect;

  export interface DecorRef {
    decorKey: string;
    type: DecorDef['type'];
    meta: DecorDef['meta'];
  }

  export type DecorGrid = Record<number, Record<number, {
    points: Set<NPC.DecorPoint>;
    colliders: Set<NPC.DecorCollidable>;
  }>>;

  export interface RoomDecorCache {
    symbol: NPC.DecorDef[];
    door: NPC.DecorDef[];
    /** Everything in room */
    decor: Record<string, NPC.DecorDef>;
    /** All colliders in room */
    colliders: NPC.DecorCollidable[];
    /** All points in room */
    points: NPC.DecorPoint[];
  }

  export type DecorPointClassKey = (
    | 'circle-right'
    | 'computer-1'
    | 'computer-2'
    | 'info'
    | 'lying-man'
    | 'road-works'
    | 'sitting-man'
    | 'standing-man'
  );

  export interface DecorSpriteSheet {
    lookup: Record<DecorPointClassKey, Geom.RectJson & {
      name: string;
    }>;
  }

  //#endregion
  
  //#region debug

  export interface PathIndicatorDef {
    key: string;
    path: Geom.VectJson[];
    meta: Geomorph.PointMeta;
  }

  //#endregion

  //#region unused
  interface NpcSynfigMetaJson {
    keyframeToMeta: {
      [keyframe: string]: {
        tags?: string[];
        'animation-direction'?: PlaybackDirection;
      }
    }    
  }
  //#endregion
  
  //#region spine

  type SpineAnimName = (
    | "idle"
    | "idle-breathe"
    | "idle-straight"
    | "lie"
    | "sit"
    | "straight-to-idle"
    | "walk"
    | "walk-alt"
  );

  type SpineHeadSkinName = (
    | "head/blonde-light"
    | "head/skin-head-dark"
    | "head/skin-head-light"
  );

  /**
   * - head `top` is the top of the head, as seen during e.g. `idle`, `walking`.
   * - head `face` is the head's face e.g. `lie`.
   */
  type SpineHeadOrientKey = (
    | 'top'
    | 'face'
  );

  interface SpineHeadOrientMapping {
    headOrientKey: SpineHeadOrientKey;
    animName: SpineAnimName;
    headAttachmentName: 'head' | 'head-lie';
    hairAttachmentName: 'hair' | 'hair-lie';
  }

  interface SpineAnimSetup {
    animName: SpineAnimName;
    headOrientKey: SpineHeadOrientKey;
    numFrames: number;
    /** If this animation is not moving, the desired fps. */
    stationaryFps: number;
  }

  //#endregion

  type TweenExt<T extends {}> = import('@tweenjs/tween.js').Tween<Partial<T>> & {
    promise(initValue?: Partial<T>): Promise<T>;
  }

}
