
declare namespace NPC {

  /** API for a single NPC */
  export interface NPC {
    /** User specified e.g. `andros` */
    key: string;
    /** Epoch ms when spawned */
    epochMs: number;
    /** Definition of NPC */
    def: NPCDef;
    el: {
      root: HTMLDivElement;
      body: HTMLDivElement;
    };
    mounted: boolean;
    anim: NPCAnimData;

    async cancel(): Promise<void>;
    clearWayMetas(): void;
    /** Has respective el ever been animated? On remount this resets. */
    everAnimated(): boolean;
    async followNavPath(
      path: Geom.VectJson[],
      opts?: { globalNavMetas?: NPC.GlobalNavMeta[]; },
    ): Promise<void>;
    /** Radians */
    getAngle(): number;
    getAnimDef(): NpcAnimDef;
    /** Used to scale up how long it takes to move along navpath */
    getAnimScaleFactor(): number;
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
    isWalking(): boolean;
    /** Returns destination angle in radians */
    lookAt(point: Geom.VectJson): number;
    pause(): void;
    play(): void;
    nextWayTimeout(): void;
    npcRef(el: HTMLDivElement | null): void;
    startAnimation(): void;
    setLookTarget(radians: number): void;
    setSpritesheet(spriteSheet: SpriteSheetKey): void;
    updateAnimAux(): void;
    wayTimeout(): void;
  }

  interface NPCAnimData {
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
    };

    spriteSheet: SpriteSheetKey;
    translate: Animation;
    rotate: Animation;
    sprites: Animation;

    wayMetas: NpcWayMeta[];
    wayTimeoutId: number;
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
    | 'walk'
  );

  interface NPCDef {
    key: string;
    angle: number;
    /** Initially paused? */
    paused: boolean;
    position: Geom.VectJson;
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
    tty: { [lineNumber: number]: SessionTtyCtxt[] }
  }

  export type SessionTtyCtxt = {
    lineNumber: number;
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
    /** The "global" 1-based index of "actual" lines ever output by tty */
    outputLineNumber: number,
    lineText: string,
    linkText: string,
    linkStartIndex: number,
  ) => void;

  export type DecorDef = { key: string } & (
    | { type: 'path'; path: Geom.VectJson[]; }
    | { type: 'circle'; center: Geom.VectJson; radius: number; }
  );

  /** Using `action` instead of `key` to avoid name-collision */
  export type NpcAction = (
    | { action: 'add-decor'; } & DecorDef
    | { action: 'cancel'; npcKey: string }
    | { action: 'config'; debug?: boolean; interactRadius?: number }
    | { action: 'get'; npcKey: string }
    | { action: 'look-at'; npcKey: string; point: Geom.VectJson }
    | { action: 'pause'; npcKey: string }
    | { action: 'play'; npcKey: string }
    | { action: 'remove-decor'; decorKey: string; }
    | { action: 'rm-decor'; decorKey: string; }
    | { action: 'set-player'; npcKey?: string }
  );

  export type NPCsEvent = (
    | { key: 'decor'; meta: DecorDef; }
    | { key: 'set-player'; npcKey: string | null; }
    | { key: 'spawned-npc'; npcKey: string; }
    | { key: 'started-walking'; npcKey: string; }
    | { key: 'stopped-walking'; npcKey: string; }
    | { key: 'unmounted-npc'; npcKey: string; }
    | NPCsWayEvent
  );

  export interface NPCsWayEvent {
    key: 'way-point';
    npcKey: string;
    meta: NpcWayMeta;
  }

}
