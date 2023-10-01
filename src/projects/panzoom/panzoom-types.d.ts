declare namespace PanZoom {

  export interface CssApi {
    ready: boolean;

    rootEl: HTMLDivElement;
    followEl: HTMLDivElement;
    panzoomEl: HTMLDivElement;
    
    /** For @see {followEl} (translation only) */
    followAnim: null | Animation;
    /** For @see {panzoomEl} (translation/scale) */
    panzoomAnim: null | Animation;
    
    opts: { minScale: number; maxScale: number; step: number; idleMs: number },

    pointers: PointerEvent[];
    origin: Geom.Vect | undefined;
    start: {
      clientX: number | undefined;
      clientY: number | undefined;
      epochMs: number;
      scale: number;
      distance: number;
    },
    /**
     * For single pointers: pointerdown without pointerup.
     * For multi pointers: pointerdown(s) without any pointerup.
     */
    ptrsAllDown: boolean;

    /** translateX of `div.panzoom-transform` */
    x: number;
    /** translateY of `div.panzoom-transform` */
    y: number;
    /** scale of `div.panzoom-transform */
    scale: number;
    
    evt: {
      wheel(e: WheelEvent): void;
      pointerdown(e: PointerEvent): void;
      pointermove(e: PointerEvent): void;
      pointerup(e: PointerEvent): void;
    };
    
    events: import('rxjs').Subject<PanZoom.CssInternalEvent>;
    /**
     * UI is considered idle i.e. _not used by user_
     * iff this is `0`.
     */
    idleTimeoutId: number;
    /**
     * Pending click identifiers, provided by code external to CssPanZoom.
     * The last click identifier is the "current one".
     */
    clickIds: string[];
    
    animationAction(type: 'cancelPanZoom' | 'cancelFollow' | 'pause' | 'play'): Promise<void>;
    private clampScale(input: number): number;
    private computePathKeyframes(path: Geom.Vect[], animScaleFactor: number): { keyframes: Keyframe[]; duration: number; };
    private delayIdle(): void;
    distanceTo(worldPosition: Geom.VectJson): number;
    /** CSS `transform`s placing world points at center of screen  */
    private getCenteredCssTransforms(worldPoints: Geom.VectJson[]): string[];
    /** Taking CSS animation into account */
    private getCurrentTransform(): { x: number; y: number; scale: number; };
    private getTrackingTranslate(): { x: number; y: number; };
    getWorld(e: { clientX: number; clientY: number; }): Geom.VectJson;
    private getWorldAtCenter(): Geom.VectJson;
    private idleTimeout(): void;
    private isFollowing(): boolean;
    /** True iff the user is NOT manually panning and zooming via pointers/mousewheel */
    isIdle(): boolean;
    async panZoomTo(opts: {
      durationMs: number;
      scale?: number;
      worldPoint?: Geom.VectJson;
      easing?: string;
      /** Can override animation.id */
      id?: string;
    }): Promise<void>;
    async followPath(path: Geom.Vect[], opts: { animScaleFactor: number }): Promise<void>;
    private releaseAnim(anim: Animation, parentEl: HTMLElement): void;
    private rootRef(el: null | HTMLDivElement): void;
    /** Use `(x, y, scale)` to set `style.transform`s */
    private setStyles(): void;
    /**
     * - Set `(x, y, scale)` using `getCurrentTransform()`
     * - Then use `(x, y, scale)` to update `style.transform`s
     */
    private syncStyles(): void;
    private zoomToClient(toScale: number, e: { clientX: number; clientY: number; }): void;
    private zoomWithWheel(event: WheelEvent): void;
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
    meta: Record<string, string | number | boolean | Geom.VectJson> & {
      /** Distance from pointerdown in world coords */
      distance: number;
      longClick: boolean;
      /** World position of target element centre */
      targetPos: Geom.VectJson;
    };
    clickId?: string;
  }

}
