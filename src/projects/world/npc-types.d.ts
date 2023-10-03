
declare namespace NPC {
  
  //#region individual npc

  /**
   * - Corresponds to media/NPC/class/{key}/{key}--{animKey}.png
   * - Corresponds to static/assets/npc/{key}/{key}--{animKey}.png
   * - Instantiated npcs are identified by their npcKey,
   *   whereas npcClassKey corresponds to their "character class".
   */
  type NpcClassKey = (
    | 'first-human-npc'
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
    /**
     * Definition of NPC. This is mutated on spawn,
     * so methods should refer to `this.def`
     */
    def: NPCDef;
    el: {
      root: HTMLDivElement;
      body: HTMLDivElement;
    };
    anim: NPCAnimData;

    /** From current do point */
    doMeta: null | Geomorph.PointMeta;
    /**
     * _Preamble_:
     * Process suspend/resume can pause/resume npc.
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
    nextWalk: null | {
      /** Future points to visit after finishing current walk */
      visits: Geom.VectJson[];
      /** Future navigation path induced by `visits` */
      navPath: NPC.GlobalNavPath;
    };
    /**
     * Initially `false` until <NPC> sets it true.
     * May also set false for cached un-rendered.
     */
    unspawned: boolean;

    cancel(overridePaused?: boolean): Promise<void>;
    canLook(): boolean;
    changeClass(npcClassKey: NPC.NpcClassKey): void;
    do(point: Geomorph.PointMaybeMeta, opts?: Pick<NpcDoDef, 'fadeOutMs' | 'extraParams'>): Promise<void>;
    /** Filter pending way metas e.g. stale collisions. */
    filterWayMetas(
      shouldRemove: (meta: NPC.NpcWayMeta) => boolean
    ): void;
    clearWayMetas(): void;
    computeWayMetaLength(navMeta: NPC.GlobalNavMeta): number;
    /** Has respective el ever been animated? On remount this resets. */
    everAnimated(): boolean;
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
    /** Used to scale up how long it takes to move along navpath */
    getAnimScaleFactor(): number;
    getInteractRadius(): number;
    getLineSeg(): null | NpcLineSeg;
    getNextDoorId(): number | undefined;
    getPosition(useCache?: boolean): Geom.Vect;
    getPrevDoorId(): number | undefined;
    getRadius(): number;
    /**
     * - Whilst walking: current speed.
     * - Whilst stopped: default speed `this.def.speed * this.walkSpeedFactor`.
     */
    getSpeed(): number;
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
    getTargets(): { point: Geom.Vect; arriveMs: number }[];
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
    isIdle(): boolean;
    /** Is this npc paused, but not necessarily @see {forcePaused}? */
    isPaused(): boolean;
    isPointBlocked(point: Geomorph.PointMaybeMeta, permitEscape?: boolean): boolean;
    isWalking(requireMoving?: boolean): boolean;
    /** Returns destination angle in radians */
    lookAt(point: Geom.VectJson): Promise<void>;
    pause(dueToProcessSuspend?: boolean): void;
    resume(dueToProcessResume?: boolean): void;
    nextWayTimeout(): void;
    npcRef(el: HTMLDivElement | null): void;
    obscureBySurfaces(): void;
    /** Started off-mesh and clicked point */
    offMeshDoMeta(point: Geomorph.PointMaybeMeta, opts: { fadeOutMs?: number; suppressThrow?: boolean }): Promise<void>;
    /** Started on-mesh and clicked point */
    onMeshDoMeta(point: Geomorph.PointMaybeMeta, opts: { fadeOutMs?: number; suppressThrow?: boolean }): Promise<void>;
    
    /** Setting null effectively reverts to default */
    setInteractRadius(radius: number | null): void;
    startAnimation(spriteSheet: SpriteSheetKey): void;
    startAnimationByMeta(meta: Geomorph.PointMeta): void;
    setSpeedFactor(speedFactor: number): void;
    animateOpacity(targetOpacity: number, durationMs: number): Promise<void>;
    animateRotate(targetRadians: number, durationMs: number, throwOnCancel?: boolean): Promise<void>;
    /** Recompute anim aux based on current path. */
    resetAnimAux(): void;
    /**
     * Invoke initially, or just after `enter-room`.
     * @param srcIndex Index of 1st vertex in room.
     */
    updateRoomWalkBounds(srcIndex: number): void;
    updateStaticBounds(): void;
    /** Update `anim.aux.index` and `anim.aux.index.segBounds` */
    updateWalkSegBounds(index: number): void;
    walk(navPath: NPC.GlobalNavPath, opts?: NPC.WalkNpcOpts | undefined): Promise<void>;
    wayTimeout(): void;
  }

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

    spriteSheet: SpriteSheetKey;
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

  type SpriteSheetKey = (
    | 'idle'
    | 'idle-breathe'
    | 'lie'
    | 'sit'
    | 'walk'
  );

  interface NPCDef {
    /** npcKey e.g. `rob` */
    key: string;
    /** npc class key e.g. `first-human-npc` */
    npcClassKey: NpcClassKey;
    angle: number;
    // paused: boolean;
    position: Geom.VectJson;
    speed: number;
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
    /** Induced by e.g. `npc config debug` or `npc config debug showIds` */
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
    | 'debugPlayer'
    | 'gmOutlines'
    | 'hideGms'
    | 'highlightWindows'
    | 'localNav'
    | 'localOutline'
    | 'logTags'
    | 'omnipresent'
    | 'scriptDoors'
    | 'showColliders'
    | 'showIds'
    | 'verbose'
  );

   /**
    * Using `action` instead of `key` to avoid name-collision.
    */
   export type NpcAction = (
    | { action: 'add-decor'; items: DecorDef[]; }
    | { action: 'config'; } // get all
    | { action: 'config'; configKey: string } // Possibly space-sep `ConfigBooleanKey`s
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
    | { key: 'on-tty-link'; linkText: string; linkStartIndex: number; ttyCtxt: NPC.SessionTtyCtxt; }
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
    | { key: 'changed-speed'; npcKey: string; prevSpeedFactor: number; speedFactor: number; }
    | { key: 'resumed-track'; npcKey: string; }
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

  //#region tty

  export interface SessionCtxt {
    /** Session key */
    key: string;
    receiveMsgs: boolean;
    /** PIDs of processes which panzoom */
    panzoomPids: number[];
    // 🤔 npcKey -> related pids? for npc-wise pause/resume
  }

  export type SessionTtyCtxt = {
    lineText: string;
    /** For example `[foo]` has link text `foo` */
    linkText: string;
    /** Where `linkText` occurs in `lineText` */
    linkStartIndex: number;
  } & (
    | { key: 'room'; gmId: number; roomId: number; }
    // ...
  );

  export type OnTtyLink = (
    /** The computations are specific to tty i.e. its parent session */
    sessionKey: string,
    lineText: string,
    linkText: string,
    linkStartIndex: number,
  ) => void;

  //#endregion

  //#region decor

  interface BaseDecor {
    key: string;
    meta: Geomorph.PointMeta;
    /** Epoch ms when last updated (overwritten) */
    updatedAt?: number;
    /** Decor key of parent, if exists */
    parentKey?: string;
  }

  export interface DecorPoint extends BaseDecor, Geom.VectJson {
    type: 'point';
    /** Can be provided in def (shorter than writing meta) */
    tags?: string[];
  }

  export interface DecorCircle extends BaseDecor, Geom.Circle {
    type: 'circle';
  }
  
  export interface DecorRect extends BaseDecor, Geom.RectJson {
    type: 'rect';
    angle?: number;
    /**
     * Induced by `{ x, y, width, height, angle }`.
     * Avoids recomputation for collisions.
     */
    derivedPoly?: Geom.Poly;
    /**
     * Aabb for `derivedPoly`.
     * Avoids recomputation for collisions.
     */
    derivedBounds?: Geom.Rect;
  }
  
  export interface DecorGroup extends BaseDecor {
    type: 'group';
    items: DecorGroupItem[];
    derivedHandlePos?: Geom.Vect;
  }

  export type DecorDef = (
    | DecorCircle
    | DecorPoint
    | DecorRect
    | DecorGroup
  );

  export type DecorGroupItem = Exclude<NPC.DecorDef, NPC.DecorGroup>;
  /** Collidable but not necessarily "freely collidable" */
  export type DecorCollidable = NPC.DecorCircle | NPC.DecorRect;

  export interface DecorRef {
    decorKey: string;
    type: DecorDef['type'];
    meta: DecorDef['meta'];
  }

  /**
   * grid[x][y] corresponds to square:
   * (x * decorGridSize, y * decorGridSize, decorGridSize, decorGridSize)
   */
  export type DecorGrid = Set<NPC.DecorCollidable>[][];

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

}
