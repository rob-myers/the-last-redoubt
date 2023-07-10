
declare namespace NPC {
  
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
    /** User specified e.g. `andros` */
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
     * Process suspend/resume for e.g. `walk` will pause/resume npc,
     * often as a side-effect of disable/enable <Tabs>.
     * But if we manually invoked npc.pause() we must avoid auto-resuming it.
     */
    manuallyPaused: boolean;
    /**
     * Initially `false` until <NPC> sets it true.
     * May also set false for cached un-rendered.
     */
    unspawned: boolean;

    cancel(): Promise<void>;
    canLook(): boolean;
    changeClass(npcClassKey: NPC.NpcClassKey): void;
    clearWayMetas(): void;
    computeWayMetaLength(navMeta: NPC.GlobalNavMeta): number;
    /** Has respective el ever been animated? On remount this resets. */
    everAnimated(): boolean;
    followNavPath(
      path: Geom.VectJson[],
      opts: {
        globalNavMetas?: NPC.GlobalNavMeta[];
        gmRoomIds?: [number, number][];
      },
    ): Promise<void>;
    /** Radians */
    getAngle(): number;
    getWalkAnimDef(): NpcAnimDef;
    /** Used to scale up how long it takes to move along navpath */
    getAnimScaleFactor(): number;
    getGmRoomId(throwIfNull?: boolean): Geomorph.GmRoomId | null;
    getInteractRadius(): number;
    getLineSeg(): null | NpcLineSeg;
    getPosition(): Geom.Vect;
    getRadius(): number;
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
    /**
     * Given npc is walking and anim.transform.currentTime,
     * infer position and angle.
     * We originally needed this because hidden tabs had `display: none`,
     * but no longer need it because `visibility: hidden`.
     * Nevertheless we'll keep this computation handy.
     */
    inferWalkTransform(): { position: Geom.Vect; angle: number; }
    /** Initialise using `def` */
    initialize(): void;
    intersectsCircle(position: Geom.VectJson, radius: number): boolean;
    isIdle(): boolean;
    isPaused(): boolean;
    isWalking(): boolean;
    /** Returns destination angle in radians */
    lookAt(point: Geom.VectJson): Promise<void>;
    pause(dueToProcessSuspend?: boolean): void;
    resume(dueToProcessResume?: boolean): void;
    nextWayTimeout(): void;
    npcRef(el: HTMLDivElement | null): void;
    obscureBySurfaces(): void;
    /** Setting null effectively reverts to default */
    setInteractRadius(radius: number | null): void;
    startAnimation(spriteSheet: SpriteSheetKey): void;
    startAnimationByMeta(meta: Geomorph.PointMeta): void;
    setSpeedFactor(speedFactor: number): void;
    animateOpacity(targetOpacity: number, durationMs: number): Promise<void>;
    animateRotate(targetRadians: number, durationMs: number, throwOnCancel?: boolean): Promise<void>;
    updateAnimAux(): void;
    /**
     * Invoke initially, or just after `enter-room`.
     * @param srcIndex Index of 1st vertex in room.
     */
    updateRoomWalkBounds(srcIndex: number): void;
    /** Update `anim.aux.index` and `anim.aux.index.segBounds` */
    updateWalkSegBounds(index: number): void;
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
      /** Last index seen of path */
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

    spriteSheet: SpriteSheetKey;
    opacity: Animation;
    translate: Animation;
    rotate: Animation;
    sprites: Animation;
    durationMs: number;
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
    /** Scale factor for speed of walking */

    /** Aligned to `path` with format `[gmId, roomId]` */
    gmRoomIds: [number, number][];
    prevWayMetas: NpcWayMeta[];
    wayMetas: NpcWayMeta[];
    wayTimeoutId: number;
  }

  /**
   * 🚧 connect these types
   */
  interface NpcConfigOpts extends Partial<Record<ConfigBooleanKey, boolean>> {
    /** Induced by e.g. `npc config debug` or `npc config debug showIds` */
    configKey?: string;
    /** Induced by e.g. `npc rm-decor myCircle` */
    decorKey?: string;
    interactRadius?: number;
    mapAction?: string;
    /** Induced by e.g. `npc get andros` */
    npcKey?: string;
    /** Suppress all errors e.g. for loop like `foo | npc do`  */
    suppressThrow?: boolean;
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
  );

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
    /** npcKey e.g. `andros` */
    key: string;
    /** npc class key e.g. `first-human-npc` */
    npcClassKey: NpcClassKey;
    angle: number;
    // paused: boolean;
    position: Geom.VectJson;
    speed: number;
  }
  
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
    fullPath: Geom.Vect[];
    /**
     * Aligned to edges of @see {fullPath}.
     * i.e. the nav node ids along each edge.
     */
    fullPartition: number[][];
    navMetas: GlobalNavMeta[];
    /**
     * Aligned to @see {fullPath}.
     * Used to restrict decors before collision prediction.
     */
    gmRoomIds?: [number, number][];
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

  export type NpcWayMetaExitRoom = Extract<NPC.NpcWayMeta, { key: 'exit-room' }>
  export type NpcWayMetaVertex = Extract<NPC.NpcWayMeta, { key: 'vertex' }>

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

  export interface SessionCtxt {
    /** Session key */
    key: string;
    receiveMsgs: boolean;
    /** PIDs of processes which panzoom */
    panzoomPids: number[];
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

  export interface DecorPath extends BaseDecor {
    type: 'path';
    path: Geom.VectJson[];
    /** Added whenever `el.style.transform` has been applied (?) */
    origPath?: Geom.VectJson[];
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
    | DecorPath
    | DecorPoint
    | DecorRect
    | DecorGroup
  );

  export type DecorSansPath = Exclude<NPC.DecorDef, NPC.DecorPath>;
  export type DecorGroupItem = Exclude<NPC.DecorDef, NPC.DecorPath | NPC.DecorGroup>;
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
  
  /** Using `action` instead of `key` to avoid name-collision */
  export type NpcAction = (
    | { action: 'add-decor'; items: DecorDef[]; }
    | { action: 'cancel'; npcKey: string }
    | { action: 'config'; } & NPC.NpcConfigOpts
    | { action: 'decor'; } & (DecorDef | { decorKey: string })
    | { action: 'do'; npcKey: string; point: Geomorph.PointWithMeta; fadeOutMs?: number; suppressThrow?: boolean; params?: any[]; }
    | { action: 'events'; }
    | { action: 'get'; npcKey: string; selector?: (npc: NPC.NPC) => any; }
    | { action: 'light'; lit?: boolean; point: Geom.VectJson }
    | { action: 'look-at'; npcKey: string; point: Geom.VectJson }
    | { action: 'map'; mapAction?: FovMapAction; timeMs?: number; }
    | { action: 'pause'; npcKey: string; cause?: 'process-suspend'; }
    | { action: 'resume'; npcKey: string; cause?: 'process-resume'; }
    | { action: 'remove-decor' | 'rm-decor'; items?: string[]; regexStr?: string; decorKey?: string; }
    | { action: 'rm' | 'remove'; npcKey: string; }
    | { action: 'set-player'; npcKey?: string }
  );

  export type NpcActionKey = NpcAction['action'];

  export type FovMapAction = 'show' | 'hide' | 'show-for-ms' | 'pause' | 'resume';

  export type NPCsEvent = (
    | { key: 'decors-added'; decors: DecorDef[]; }
    | { key: 'decor-click'; decor: DecorDef; }
    | { key: 'decors-removed'; decors: DecorDef[]; }
    | { key: 'disabled' }
    | { key: 'enabled' }
    | { key: 'fov-changed'; gmRoomIds: Graph.GmRoomId[]; added: Graph.GmRoomId[]; removed: Graph.GmRoomId[] }
    | { key: 'npc-clicked'; npcKey: string; position: Geom.VectJson; isPlayer: boolean; }
    | { key: 'npc-internal'; npcKey: string; event: 'cancelled' | 'paused' | 'resumed' }
    | { key: 'on-tty-link'; linkText: string; linkStartIndex: number; ttyCtxt: NPC.SessionTtyCtxt; }
    | { key: 'removed-npc'; npcKey: string; }
    | { key: 'set-player'; npcKey: string | null; }
    | { key: 'spawned-npc'; npcKey: string; intoDecor: NPC.DecorRef[] }
    | { key: 'started-walking'; npcKey: string; }
    | { key: 'stopped-walking'; npcKey: string; }
    | { key: 'changed-speed'; npcKey: string; prevSpeedFactor: number; speedFactor: number; }
    | NPCsWayEvent
  );

  export type NPCsEventWithNpcKey = Extract<NPCsEvent, { npcKey: string | null }>;

  export interface NPCsWayEvent {
    key: 'way-point';
    npcKey: string;
    meta: NpcWayMeta;
  }

  //#region parse
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
