
declare namespace NPC {
  
  /**
   * - Corresponds to static/assets/npc/{key}/{key.json}.
   * - Instantiated npcs are identified by their npcKey,
   *   whereas npcJsonKey corresponds to their "character class".
   */
  type NpcJsonKey = (
    | 'first-human-npc'
  );

  interface NpcMetaJson {
    jsonKey: NpcJsonKey;
    parsed: NPC.ParsedNpc;
    /** Scale factor we'll apply to sprites. (?) */
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
    /** Refers to `static/assets/npc/{jsonKey}/{jsonKey}.json` */
    jsonKey: NPC.NpcJsonKey;
    /** Epoch ms when spawned */
    epochMs: number;
    /**
     * Definition of NPC.
     * This can be mutated, so methods should refer to `this.def`
     */
    def: NPCDef;
    el: {
      root: HTMLDivElement;
      body: HTMLDivElement;
    };
    unspawned: boolean;
    anim: NPCAnimData;

    cancel(): Promise<void>;
    clearWayMetas(): void;
    /**
     * We can use native commitStyles here because hidden tab is
     * `visibility: hidden` i.e. this will still work when tab hidden.
     */
    commitWalkStyles(): void;
    /** Has respective el ever been animated? On remount this resets. */
    everAnimated(): boolean;
    followNavPath(
      path: Geom.VectJson[],
      opts?: { globalNavMetas?: NPC.GlobalNavMeta[]; },
    ): Promise<void>;
    /** Radians */
    getAngle(): number;
    getAnimDef(): NpcAnimDef;
    /** Used to scale up how long it takes to move along navpath */
    getAnimScaleFactor(): number;
    /**
     * Get current bounds e.g. whilst walking.
     * If not walking i.e. static, use
     * @see NPC['anim']['staticBounds']
     */
    getBounds(): Geom.Rect;
    getLineSeg(): null | NpcLineSeg;
    getPosition(): Geom.Vect;
    getRadius(): number;
    getSpeed(): number;
    /**
     * Given duration of upcoming motion,
     * and also `npcWalkAnimDurationMs`,
     * adjust the latter sprite cycle duration
     * to end on a nice frame (avoids flicker).
     */
    getSpriteDuration(nextMotionMs: number): number;
    getTarget(): null | Geom.Vect;
    getTargets(): { point: Geom.Vect; arriveMs: number }[];
    getWalkBounds(): Geom.Rect;
    getWalkSegBounds(): Geom.Rect;
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
    isWalking(): boolean;
    /** Returns destination angle in radians */
    lookAt(point: Geom.VectJson): number;
    pause(): void;
    play(): void;
    nextWayTimeout(): void;
    npcRef(el: HTMLDivElement | null): void;
    setLookRadians(radians: number): void;
    // setSegs(segs: Geom.Seg[]): void;
    setSpritesheet(spriteSheet: SpriteSheetKey): void;
    startAnimation(): void;
    syncLookAngle(): void;
    updateAnimAux(): void;
    /** Update `anim.aux.index` and `anim.aux.index.segBounds` */
    updateWalkSegBounds(index: number): void;
    wayTimeout(): void;
  }

  interface NPCAnimData {
    /** Sprite sheet related CSS */
    css: string;
    /** The path we'll walk along */
    path: Geom.Vect[];
    /** Data derived entirely from `anim.path` */
    aux: {
      angs: number[];
      bounds: Geom.Rect;
      edges: ({ p: Geom.Vect; q: Geom.Vect })[];
      elens: number[];
      /** Outset version of `origPath` to detect progress on pause */
      navPathPolys: Geom.Poly[];
      sofars: number[];
      total: number;
      /** Last index seen of path */
      index: number;
      segBounds: Geom.Rect;
    };
    /** Bounds when stationary */
    staticBounds: Geom.Rect;

    spriteSheet: SpriteSheetKey;
    translate: Animation;
    rotate: Animation;
    sprites: Animation;
    durationMs: number;

    wayMetas: NpcWayMeta[];
    wayTimeoutId: number;
  }

  interface NpcConfigOpts extends Partial<Record<ConfigBooleanKey, boolean>> {
    interactRadius?: number;
    /** Induced by e.g. `npc rm-decor myCircle` */
    decorKey?: string;
    /** Induced by e.g. `npc get andros` */
    npcKey?: string;
    /** Induced by e.g. `npc config debug` or `npc config debug showIds` */
    configKey?: string;
  }

  type ConfigBooleanKey = (
    | 'canClickArrows'
    | 'debug'
    | 'gmOutlines'
    | 'highlightWindows'
    | 'localNav'
    | 'localOutline'
    | 'omnipresent'
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
    | 'sit'
    | 'walk'
  );

  interface NPCDef {
    /** npcKey e.g. `andros` */
    key: string;
    /** npc class key e.g. `first-human-npc` */
    npcJsonKey: NpcJsonKey;
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
    navMetas: GlobalNavMeta[];
  }

  /**
   * A `FloorGraph` nav meta enriched with id of geomorph instance it resides in.
   * May be used e.g. to trigger light change on enter-room via a hull door.
   */
  export type GlobalNavMeta = Graph.FloorGraphNavMeta & {
    gmId: number;
  }

  /**
   * An npc way meta is a global nav meta, with `length` along the navpath it'll trigger.
   * - `length` is naturally computed using existing npc anim computations.
   * - `length` may be earlier than distance along path to respective node,
   *    and may also depend on npc's radius.
   */
  export type NpcWayMeta = GlobalNavMeta & {
    /** Computed via `anim.sofars` */
    length: number;
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
    tty: { [lineText: string]: SessionTtyCtxt[] }
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

  interface BaseDecor {
    key: string;
    /** Epoch ms when last updated (overwritten) */
    updatedAt?: number;
    /** last valid `el.style.transform` directly set by user via devtool */
    devtoolTransform?: string;
  }

  export interface DecorPoint extends BaseDecor, Geom.VectJson {
    type: 'point';
    tags?: string[];
  }

  export interface DecorPath extends BaseDecor {
    type: 'path';
    path: Geom.VectJson[];
    /** Added whenever `el.style.transform` has been applied */
    origPath?: Geom.VectJson[];
  }

  export type DecorDef = (
    | BaseDecor & { type: 'circle' } & Geom.Circle
    | DecorPath
    | DecorPoint
    | BaseDecor & { type: 'rect' } & Geom.RectJson & { angle?: number }
  );
  
  /** Using `action` instead of `key` to avoid name-collision */
  export type NpcAction = (
    | { action: 'add-decor'; items: DecorDef[]; }
    | { action: 'cancel'; npcKey: string }
    | { action: 'config'; } & NPC.NpcConfigOpts
    | { action: 'decor'; } & (DecorDef | { decorKey: string })
    | { action: 'events'; }
    | { action: 'get'; npcKey: string }
    | { action: 'look-at'; npcKey: string; point: Geom.VectJson }
    | { action: 'pause'; npcKey: string }
    | { action: 'play'; npcKey: string }
    | { action: 'remove-decor' | 'rm-decor'; items?: string[]; regexStr?: string; decorKey?: string; }
    | { action: 'rm' | 'remove'; npcKey: string; }
    | { action: 'set-player'; npcKey?: string }
  );

  export type NpcActionKey = NpcAction['action'];

  export type NPCsEvent = (
    | { key: 'decors-added'; decors: DecorDef[]; }
    | { key: 'decor-click'; decor: DecorDef; }
    | { key: 'decors-removed'; decors: DecorDef[]; }
    | { key: 'disabled' }
    | { key: 'enabled' }
    | { key: 'fov-changed'; gmRoomIds: Graph.GmRoomId[]; added: Graph.GmRoomId[]; removed: Graph.GmRoomId[] }
    | { key: 'set-player'; npcKey: string | null; }
    | { key: 'spawned-npc'; npcKey: string; }
    | { key: 'started-walking'; npcKey: string; }
    | { key: 'stopped-walking'; npcKey: string; }
    | { key: 'unlit-geomorph-loaded'; gmKey: Geomorph.LayoutKey; gmId: number; }
    | { key: 'unmounted-npc'; npcKey: string; }
    | { key: 'world-ready'; }
    | NPCsWayEvent
  );

  export interface NPCsWayEvent {
    key: 'way-point';
    npcKey: string;
    meta: NpcWayMeta;
  }

  //#region parse
  interface ParsedNpc {
    npcJsonKey: NpcJsonKey;
    animLookup: { [animName: string]: NpcAnimMeta };
    /** Axis aligned bounded box, already scaled by `zoom` */
    aabb: Geom.RectJson;
    synfigMeta: NpcSynfigMetaJson;
    /** Zoomed radius */
    radius: number;
    /** How much the rendered PNGs have been scaled up. */
    zoom: number;
  }


  interface NpcAnimMeta {
    animName: string;
    frameCount: number;
    /** Aligned to frames i.e. positions of feet contacts (if any) */
    contacts: { left?: Geom.VectJson; right?: Geom.VectJson; }[];
    /**
     * One more than number of frames i.e. how far we move to the right.
     * Final number is distance from last to first.
     */
    deltas: number[];
    /** The sum of `deltas` */
    totalDist: number;

    pathPng: string;
    pathWebp: string;
  }

  interface NpcSynfigMetaJson {
    keyframeToMeta: {
      [keyframe: string]: {
        tags?: string[];
        'animation-direction'?: string;
      }
    }    
  }

  //#endregion

}
