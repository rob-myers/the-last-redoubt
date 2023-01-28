declare namespace PanZoom {

  export interface CssApi {
    ready: boolean;
    parent: HTMLDivElement;
    translateRoot: HTMLDivElement;
    scaleRoot: HTMLDivElement;
    
    panning: boolean;
    opts: { minScale: number; maxScale: number; step: number; idleMs: number },
    pointers: PointerEvent[];
    origin: Vect | undefined;
    /** Target scale in `scaleRoot` */
    scale: number;
    start: {
      clientX: number | undefined;
      clientY: number | undefined;
      scale: number;
      distance: number;
    },
    /** Target translateX in `translateRoot` */
    x: number;
    /** Target translateY in `translateRoot` */
    y: number;
    
    evt: {
      wheel(e: WheelEvent): void;
      pointerdown(e: PointerEvent): void;
      pointermove(e: PointerEvent): void;
      pointerup(e: PointerEvent): void;
    };
    
    events: import('rxjs').Subject<PanZoom.CssInternalEvent>;
    /** UI is considered idle iff this is 0 */
    idleTimeoutId: number;
    transitionTimeoutId: number;
    /** [translate, scale] */
    anims: [null | Animation, null | Animation];
    worldPointerDown: Geom.Vect;
    pointerUpExtras: Record<string, any>[];
    
    animationAction(type: 'cancel' | 'pause' | 'play' | 'smooth-cancel'): void;
    private computePathKeyframes(path: Geom.Vect[]): { keyframes: Keyframe[]; distance: number; };
    private delayIdle(): void;
    distanceTo(worldPosition: Geom.Vect): number;
    /** Taking CSS animation into account */
    getCurrentTransform(): { x: number; y: number; scale: number; };
    getWorld(e: { clientX: number; clientY: number; }): Geom.VectJson;
    getWorldAtCenter(): Geom.VectJson;
    private idleTimeout(): void;
    isIdle(): boolean;
    async panZoomTo(scale?: number, worldPoint?: Geom.VectJson, durationMs: number, easing?: string): Promise<void>;
    async followPath(path: Geom.Vect[], { animScaleFactor: number });
    releaseAnim(anim: Animation, parentEl: HTMLElement): void;
    rootRef(el: null | HTMLDivElement): void;
    /** Use `(x, y, scale)` to set `style.transform`s */
    setStyles(): void;
    /**
     * - Set `(x, y, scale)` using `getCurrentTransform()`
     * - Then use `(x, y, scale)` to update `style.transform`s
     */
    syncStyles(): void;
    zoomToClient(toScale: number, e: { clientX: number; clientY: number; }): void;
    zoomWithWheel(event: WheelEvent): void;
  }

  type CssInternalEvent = (
    | CssTransitionEvent
    | { key: 'started-wheel' }
    | CssPointerUpEvent
    | { key: "ui-idle" }
    | { key: "resized-bounds"; bounds: Geom.RectJson }
  )

  type CssTransitionEvent = (
    | { key: "cancelled-panzoom-to" }
    | { key: "completed-panzoom-to" }
    | { key: "started-panzoom-to" }
  )

  interface CssPointerUpEvent {
    key: 'pointerup';
    point: Geom.VectJson;
    /** Distance from pointerdown in world coords */
    distance: number;
    tags: string[];
    extra: Record<string, any>;
  }

}
