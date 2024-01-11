declare namespace Geomorph {

  type Poly = Geom.Poly;
  type PolyJson = Geom.GeoJsonPolygon;
  type Vect = Geom.Vect;

  export interface RenderOpts {
    scale?: number;

    obsBounds?: boolean;
    wallBounds?: boolean;
    navTris?: boolean;
    navOutline?: boolean;
    doors?: boolean;
    thinDoors?: boolean;
    hullDoorBases?: boolean;
    labels?: boolean;
    arrows?: boolean;
    /** Floor highlights and obstacle drop-shadow */
    highlights?: boolean;

    floorColor?: string;
    navColor?: string;
    navStroke?: string;
    obsColor?: string;
    wallColor?: string;
    invertSymbols?: boolean;
    darken?: boolean;
  }

  /** Generated via `yarn svg-meta`. */
  export type SvgJson = Record<string, ParsedSymbol<Geom.GeoJsonPolygon>>;

  /** Parsed version of `SvgJson`  */
  export type SymbolLookup = Record<string, ParsedSymbol<Poly>>;

  /**
   * - `ParsedSymbol<GeoPolyJson>` used in `SvgJson`
   * - `ParsedSymbol<Poly>` used in `SymbolLookup`
   */
   export interface ParsedSymbol<T> extends SvgGroups<T> {
    key: SymbolKey;
    /** Hull walls, only in hull */
    hull: T[];
    /** Original SVG's width, inferred from `viewBox` */
    width: number;
    /** Original SVG's height, inferred from `viewBox` */
    height: number;
    /** How much larger `{symbol}.png` is than `{symbol}.svg`. */
    svgPngScale: number;
    /**
     * Bounds of original image in symbol SVG.
     * May be offset e.g. because doors are centred along edges.
     */
    pngRect: Geom.RectJson;
    /** Since epoch in ms */
    lastModified: number;
  }

  interface SvgGroups<T> {
    obstacles: SvgGroupWithTags<T>[];
    singles: SvgGroupWithTags<T>[];
    walls: T[];
  }

  interface SvgGroupWithTags<T> {
    poly: T;
    meta: Geomorph.PointMeta;
  }

  /**
   * The layout of a single geomorph constructed from a
   * @see LayoutDef and the 
   * @see SymbolLookup.
   */
  export interface Layout<P, G, V, R> {
    /** e.g. `"g-301--bridge"` */
    key: GeomorphKey;
    /** e.g. `301` */
    id: number;

    def: LayoutDef;
    /** Transformed and filtered groups */
    groups: SvgGroups<P>;

    /** Arise from holes in hull polygon and referenced in `roomGraph`. */
    rooms: P[];
    doors: BaseConnectorRect<P, V, R>[];
    windows: BaseConnectorRect<P, V, R>[];
    labels: LayoutLabel[];
    /** The navigable area including doorways. */
    navPoly: P[];
    /** Serializable navigation zone used for pathfinding */
    navZone: Nav.ZoneWithMeta;
    /** Connectivity graph involving rooms and doors */
    roomGraph: G;
    /** Sources of lights rendered inside PNG  */
    lightSrcs: { position: V; roomId: number; distance?: number; }[];
    /**
     * Polygons cast by light going through `doorId` (or `windowId`) into adjacent room.
     */
    lightThrus: BaseLightThruConnector<R, P>[];
    /** Pointers into `groups.singles`. */
    floorHighlightIds: number[];

    /** Pointers into `groups.obstacles` indexed by roomId. */
    roomSurfaceIds: Record<number, number[]>;
    /** Indexed by `roomId` */
    roomMetas: Geomorph.PointMeta<{
      roomId: number;
      hull: boolean;
      leaf: boolean;
    }>[];
    /** `gridToRoomIds[x][y]` are roomIds  */
    gridToRoomIds: Geomorph.Grid<number>;
    /** Indexed by `doorId` */
    relDoorId: Geomorph.RelDoor;
    /** Indexed by `doorId` */
    parallelDoorId: Geomorph.ParallelDoor;
    
    meta: Geomorph.PointMeta;

    /** Should probably have exactly one polygon */
    hullPoly: P[];
    /** Bounds of hull */
    hullRect: Geom.RectJson;
    /** Top of hull, sans windows/doors */
    hullTop: P[];

    /**
     * Symbol instances i.e. PNGs with transforms.
     * The first is always the hull symbol, and corresponds to the respective original geomorph.
     */
    items: {
      key: Geomorph.SymbolKey;
      /** How much larger `{symbol}.png` is than `{symbol}.svg`. */
      svgPngScale: number;
      /** Path to PNG */
      pngHref: string;
      /** True bounds including overflow (e.g. doors) */
      pngRect: Geom.RectJson;
      /** If absent use identity transform */
      transformArray?: LayoutDefItem['transform'];
      /** If absent use identity transform */
      transform?: string;
      invert?: boolean;
      lighten?: boolean;
    }[];
  }
  
  export type ParsedLayout = Layout<Poly, Graph.RoomGraph, Geom.Vect, Geom.Rect>;
  export type LayoutJson = Layout<PolyJson, Graph.RoomGraphJson, Geom.VectJson, Geom.RectJson>;

  /**
   * Geomorph.ParsedLayout with derived data.
   * This is the type of useGeomorphData's data.
   */
  export interface GeomorphData extends Geomorph.ParsedLayout {

    roomsWithDoors: Poly[];
    hullDoors: BaseConnectorRect<Poly, Geom.Vect, Geom.Rect>[];
    hullOutline: Poly;
    /** Bounds in world coordinates */
    pngRect: Geom.Rect;

    //#region aligned to doors
    
    /** At most one light rect, viewing light as going outwards through door. */
    doorToLightThru: (Geomorph.LightThruConnector | undefined)[];
    windowToLightThru: (Geomorph.LightThruConnector | undefined)[];
    //#endregion

    /** View position overrides, local wrt their parent geomorph. */
    roomOverrides: {
      [roomId: number]: {
        /** Can specify view position(s) from room through door */
        doorViews: { [doorId?: number]: { point: Vect; meta: PointMeta; }[] };
        /** Can specify view position from room through window */
        windowView: { [windowId?: number]: Vect };
      };
    };

    /**
     * Indexed by `roomId`.
     * - `symbol` from a symbol's group.singles
     * - `door` contains "door sensors".
     */
    roomDecor: {
      /** decor from room symbol's group.singles */
      symbol: NPC.DecorDef[];
      /** door sensors for each door */
      door: NPC.DecorDef[];
    }[];

    /** Proxy for lazy cached data */
    lazy: {
      /** If multiple nav polys, this is the largest one  */
      roomNavPoly: {
        [roomId: number]: Poly;
      };
    };

    floorGraph: Graph.FloorGraph;

    /** Returns -1 if not found. */
    findRoomContaining(point: Geom.VectJson, includeDoors?: boolean): number;
    /** Convex hull of door with a point "beyond" view position  */
    /**
     * Get non-null roomId adjacent to dstDoorId s.t. furthest from srcDoorId.
     * For hull doors this will be the only roomId referenced.
     */
    getFurtherDoorRoom(srcDoorId: number, dstDoorId: number): number;
    /** Returns -1 if a hull door. */
    getOtherRoomId(doorId: number, roomId: number): number;
    getParallelDoorIds(doorId: number): number[];
    /** Get doorIds related via tag `relate-connectors` */
    getRelatedDoorIds(doorId: number): number[];
    /**
     * By default we move "the view" outside current room by constant amount.
     * Sometimes this can look bad, so can override via "view"-tagged rect(s).
     */
    getViewDoorPositions(roomId: number, doorId: number): Vect[];
    getViewWindowPosition(rootRoomId: number, doorId: number);
    /** Inside @see {srcRoomId} looking through adjacent @see {srcDoorId}, is @see {dstDoorId} behind? */
    isOtherDoorBehind(srcRoomId: number, srcDoorId: number, dstDoorId: number): boolean;
    isHullDoor(doorId: number): boolean;

    /**
     * Raycast `src -> dst` against `roomWithDoors[roomId]`, returning
     * `{ doorId, lambda }` if respective door from doorIds was earliest hit.
     * The intersection is `src + lambda.(dst - src)`.
     */
    rayIntersectsDoor(
      src: Geom.VectJson,
      dst: Geom.VectJson,
      roomId: number,
      doorIds: number[],
    ): null | { doorId: number; lambda: number; };

  }

  export interface GmRoomId {
    gmId: number;
    roomId: number;
  }

  export interface GmDoorId {
    /** `g{gmId}-d${doorId}` */
    key: string;
    gmId: number;
    doorId: number;
    /** Non-isolated hull doors have an associated door */
    other?: { gmId: number; doorId: number };
  }
  
  export interface GmDoorIdWithMeta extends Geomorph.GmDoorId  {
    behind: [boolean, boolean];
    depDoors?: Geomorph.GmDoorId[];
  }

  export interface RelDoor {
    [doorId: number]: {
      doors: number[];
      windows: number[];
      metas: {
        [otherDoorId: number]: RelDoorMeta;
      };
    }
  }
  
  export interface RelDoorMeta {
    /**
     * `relDoorId[doorId].metas[otherDoorId].behind[i]` <=>
     * from `rooms[i]` of doorId whilst looking through `doorId`,
     * `otherDoorId` is behind (via dot product).
     */
    behind: [boolean, boolean];
    /** 
     * Intermediate doorIds which must be open for this relation to be valid.
     * We can stop after first failure.
     */
    depIds?: number[];
  }

  export interface RelDoorMeta {

  }

  export interface ParallelDoor {
    [doorId: number]: {
      doors: number[];
    }
  }

  /**
   * 🚧 Change name i.e. needn't arise from point.
   */
  export type PointMeta<T extends {} = {}> = Record<string, (
    | string
    | boolean
    | number
    | Geom.VectJson
    | Geom.VectJson[]
    | Record<number, true>
    | [number, number, number, number, number, number]
    | null
  )> & T;

  export type PointWithMeta = Geom.VectJson & {
    meta: Geomorph.PointMeta;
  }
  export type PointMaybeMeta = Geom.VectJson & {
    meta?: Geomorph.PointMeta;
  }

  export interface UseGeomorphsDefItem {
    gmKey: GeomorphKey;
    transform?: [number, number, number, number, number, number];
  }

  /**
   * Geomorph.GeomorphData with an associated transform,
   * and various induced data e.g. transformOrigin.
   */
  export interface GeomorphDataInstance extends Geomorph.GeomorphData {
    /** Position in @see {Graph.GmGraph.gms} */
    gmId: number;
    /** `${gm.key}-[${transform}]` */
    itemKey: string;
    transform: [number, number, number, number, number, number];
    transformStyle: string;
    matrix: Geom.Mat;
    inverseMatrix: Geom.Mat;
    pixiTransform: Geom.PixiTransform;

    worldPngRect: Geom.Rect;
    /**
     * Sub-rectangle of `600 * 600` grid
     * - "Standard Geomorphs" are `1200 * 1200`
     * - "Edge Geomorphs" are `1200 * 600`
     */
    gridRect: Geom.Rect;
    /** Instantiation of @see {Geomorph.GeomorphData.roomDecor} */
    gmRoomDecor: NPC.RoomDecorCache[];

    toLocalCoords(worldPoint: Geom.VectJson): Geom.Vect;
    toWorldCoords(localPoint: Geom.VectJson): Geom.Vect;
  }

  /**
   * Includes measurements for canvas-based
   * debug geomorph rendering. In practice,
   * labels would be should via CSS if at all.
   */
  export interface LayoutLabel {
    /** The label */
    text: string;
    /** Originally specified in symbol svg */
    center: Geom.VectJson;
    /** Index inside `Geomorph['labels']` */
    index: number;
    /** Measured world rect containing text */
    rect: Geom.RectJson;
  }

  export interface LayoutDef {
    /**
     * Corresponds to basename of original PNG, e.g.
     * `g-301--bridge` where /assets/debug/g-301--bridge.png exists.
     */
    key: GeomorphKey;
    /** e.g. `301` */
    id: number;
    items: LayoutDefItem[];
  }

  export interface LayoutDefItem {
    id: SymbolKey;
    /**
     * - If manually specified, this overrides `x`, `y`, `a`, `flip`.
     * - If unspecified, it will be computed using latter and stored in
     *   the geomorph JSONs.
     */
    transform?: [number, number, number, number, number, number];
    /** left _after_ transformation by @see {a} @see {flip} */
    x?: number;
    /** top _after_ transformation by @see {a} @see {flip} */
    y?: number;
    /** Added to `y` but not propagated */
    dy?: number;
    /** angle (applied first) */
    a?: 0 | 90 | 180 | 270;
    /** flip (post-composed) */
    flip?: 'x' | 'y' | 'xy';
    /**
     * - `right` (default) i.e. next is to the right of current.
     * - `down` i.e. next is below current.
     * - `above` i.e. next is drawn over current.
     */
    next?: 'right' | 'down' | 'above';
    invert?: boolean;
    lighten?: boolean;

    /** Defined iff this is a nested symbol i.e. arises as a "single" `symbol key={symbolKey}` */
    preTransform?: [number, number, number, number, number, number];
    /** Offset from previous */
    at?: LayoutAtChoice;

    /** Door tags */
    doors?: string[];
    /** Wall tags */
    walls?: string[];
  }

  export type LayoutAtChoice = (
    | '👉'
    | '👇'
    | '⏪👇'
    | '⏪👉'
    | '⏪⏪👉'
  );
  
  export type GeomorphKey = (
    | 'g-101--multipurpose'
    | 'g-102--research-deck'
    | 'g-103--cargo-bay'
    | 'g-301--bridge'
    | 'g-302--xboat-repair-bay'
    | 'g-303--passenger-deck'
  );

  export type SymbolKey = (
    | 'extra--locker--001--1x0.33'
    | 'extra--table--001--1x0.2' 
    | 'extra--table--002--0.4x0.4'
    | 'extra--table--003--0.2x0.2'
    | 'extra--table--004--0.4x0.2'
    | 'extra--tv--001--0.5x0.1'
    //
    | '101--hull'
    | '102--hull'
    | '103--hull'
    | '301--hull'
    | '302--hull'
    | '303--hull'
    | 'bridge--042--8x9'
    | 'cargo--002--2x2'
    | 'cargo--003--2x4'
    | 'cargo--010--2x4'
    | 'console--018--1x1'
    | 'console--022--1x2'
    | 'console--031--1x1'
    | 'couch-and-chairs--006--0.4x2'
    | 'empty-room--006--2x2'
    | 'empty-room--013--2x3'
    | 'empty-room--019--2x4'
    | 'empty-room--020--2x4'
    | 'empty-room--039--3x4'
    | 'empty-room--060--4x4'
    | 'empty-room--074--8x4'
    | 'empty-room--076--3x5'
    | 'engineering--045--6x4'
    | 'engineering--047--4x7'
    | 'fresher--002--0.4x0.6'
    | 'fresher--020--2x2'
    | 'fresher--025--3x2'
    | 'fresher--036--4x2'
    | 'fuel--010--4x2'
    | 'gaming-tables--001--2x1'
    | 'galley-and-mess-halls--006--4x2'
    | 'galley-and-mess-halls--025--2x3'
    | 'iris-valves--005--1x1'
    | 'lifeboat--small-craft--2x4'
    | 'lab--012--4x3'
    | 'lab--018--4x4'
    | 'lab--023--4x4'
    | 'lab--030--3x1'
    | 'lounge--009--3x2'
    | 'lounge--015--4x2'
    | 'lounge--017--4x2'
    | 'low-berth--003--1x1'
    | 'machinery--001--0.4x1'
    | 'machinery--020--1x1.6'
    | 'machinery--065--1.8x1.8'
    | 'machinery--091--1.6x1.8'
    | 'machinery--155--1.8x3.6'
    | 'machinery--156--2x4'
    | 'machinery--158--1.8x3.6'
    | 'machinery--357--4x2'
    | 'machinery--077--1.6x1.8'
    | 'medical--007--3x2'
    | 'medical--008--3x2'
    | 'medical-bed--006--1.6x3.6'
    | 'misc-stellar-cartography--020--10x10'
    | 'misc-stellar-cartography--023--4x4'
    | 'office--001--2x2'
    | 'office--004--2x2'
    | 'office--006--2x2'
    | 'office--020--2x3'
    | 'office--023--2x3'
    | 'office--025--2x3'
    | 'office--026--2x3'
    | 'office--055--2x4'
    | 'office--061--3x4'
    | 'office--074--4x4'
    | 'office--089--4x4'
    | 'sensors--003--1.4x1'
    | 'ships-locker--003--1x1'
    | 'ships-locker--007--2x1'
    | 'ships-locker--020--2x2'
    | 'ships-locker--011--2x1'
    | 'shop--027--1.6x0.4'
    | 'shop--028--1.6x0.8'
    | 'stateroom--012--2x2'
    | 'stateroom--014--2x2'
    | 'stateroom--018--2x3'
    | 'stateroom--019--2x3'
    | 'stateroom--020--2x3'
    | 'stateroom--035--2x3'
    | 'stateroom--036--2x4'
    | 'stateroom--100--3x4'
    | 'table--009--0.8x0.8'
    | 'weaponry--013--1x2'
    | 'window--001--1x0.2'
    | 'window--007--3x0.2'
  );

  export interface BaseConnectorRect<P, V, R> extends Geom.AngledRect<R> {
    poly: P;
    /** `poly.rect` i.e. rotated rectangle */
    rect: R;
    /** Segment through middle of door */
    seg: [V, V];
    /**
     * Points towards `entries[0]`.
     */
    normal: V;
    meta: Geomorph.PointMeta;
    /**
     * `[id of room infront, id of room behind]`
     * where a room is *infront* if `normal` is pointing towards it.
     * Hull doors have exactly one non-null entry.
     */
    roomIds: [null | number, null | number];
    /**
     * Aligned to `roomIds` i.e. `[infront, behind]`
     * where a room is *infront* if `normal` is pointing towards it.
     */
    entries: [V, V];
    /**
     * This door is connected to navmesh navZone.groups[navGroupId].
     */
    navGroupId: number;
  }

  type ConnectorRect = BaseConnectorRect<Geom.Poly, Geom.Vect, Geom.Rect>;
  type ConnectorRectJson = BaseConnectorRect<Geom.GeoJsonPolygon, Geom.VectJson, Geom.RectJson>;

  /**
   * Polygon cast by light going through `doorId` (or `windowId`) into adjacent room.
   */
  export interface BaseLightThruConnector<R extends Geom.RectJson, P> {
    /**
     * `door{doorId}@light{lightId}`
     * or `window{windowId}@light{lightId}`
     */
    key: string;
    /** If `windowId ≥ 0` this is `-1`. */
    doorId: number;
    /** If `doorId ≥ 0` this is `-1`. */
    windowId: number;
    lightId: number;
    srcRoomId: number;
    rect: R;
    poly: P;
    /** Ids of prior connectors i.e. closer to light source (earlier index closer)  */
    preConnectors: { type: 'door' | 'window'; id: number }[];
    /** Ids of later connectors i.e. further from light source (earlier index closer)  */
    postConnectors: { type: 'door' | 'window'; id: number }[];
  }

  /**
   * Polygon cast by light going through `doorId` (or `windowId`) into adjacent room.
   */
  export type LightThruConnector = BaseLightThruConnector<Geom.Rect, Geom.Poly>;

  /**
   * Fast geometric lookup via well-chosen grid dimension.
   * `grid[x][y]` corresponds to square:
   * > `(x * decorGridSize, y * decorGridSize, decorGridSize, decorGridSize)`
   */
  export type Grid<T> = Record<number, Record<number, T[]>>;
  
  /**
   * Fast geometric lookup via well-chosen grid dimension, @see {Grid<T>}
   */
  export type GridSet<T> = Record<number, Record<number, Set<T>>>;
 
  // 🚧 remove
  export interface HitTestGlobal {
    gridDim: number;
    /** World coords modulo @see {gridDim} */
    grid: Geomorph.Grid<CanvasRenderingContext2D>;
    /** Aligned to dfs of grid */
    ctxts: CanvasRenderingContext2D[];
  }
}
