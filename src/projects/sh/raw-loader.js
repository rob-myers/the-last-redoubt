/* eslint-disable no-undef, no-useless-escape, require-yield, @typescript-eslint/ban-ts-comment */
/**
 * This file is loaded via webpack `raw-loader` to avoid function transpilation.
 * 
 * __BEWARE__ currently must avoid single-quotes inside function bodies
 * 
 * - `utilFunctions` is provided by the context
 * - We'll extend it using @see utilFunctionsRunDefs
 * - They are both arrays in order to support future versions of the named functions.
 * 
 * - `gameFunctions` is provided by the context
 * - We'll extend it using @see gameFunctionsDefs
 */

//#region defs

/**
 * @typedef RunArg @type {object}
 * @property {import('./cmd.service').CmdService['processApi'] & { getCached(key: '__WORLD_KEY_VALUE__'): import('../world/World').State }} api
 * @property {string[]} args
 * @property {{ [key: string]: any; 'WORLD_KEY': '__WORLD_KEY_VALUE__'; }} home
 * @property {*} [datum] A shortcut for declaring a variable
 * @property {*[]} [promises] Another shortcut
 */

/**
 * Definitions of util shell functions based on builtin `run`.
 * 
 * A key-value in this lookup e.g.
 * > `['foo', function*({ args }) { 42; }]`
 * 
 * will eventually become e.g.
 * > ``['foo', `run '({ args }) { 42; }' "$@"`]``.
 * @type {Record<string, (arg: RunArg) => void>[]}
 */
 const utilFunctionsRunDefs = [
  {
  
    /** Evaluate and return a javascript expression */
    expr: function* ({ api, args }) {
      const input = args.join(" ")
      yield api.parseJsArg(input)
    },
  
    /** Filter inputs */
    filter: async function* (ctxt) {
      let { api, args, datum } = ctxt
      const func = Function(`return ${args[0]}`)()
      while ((datum = await api.read()) !== null)
        if (func(datum, ctxt)) yield datum
    },

    /** Combines map (singleton), filter (empty array) and split (of arrays) */
    flatMap: async function* (ctxt) {
      let { api, args, datum } = ctxt, result
      const func = Function(`return ${args[0]}`)()
      while ((datum = await api.read(true)) !== null) { 
        if (datum.__chunk__) yield { ...datum, items: /** @type {any[]} */ (datum.items).flatMap(x => func(x, ctxt)) }
        else {
          if (Array.isArray(result = func(datum, ctxt))) for (const item of result) yield item;
          else yield result;
        }
      }
    },
  
    /** Execute a javascript function */
    call: async function* (ctxt) {
      const func = Function(`return ${ctxt.args[0]}`)()
      ctxt.args = ctxt.args.slice(1)
      yield await func(ctxt)
    },
  
    /** Apply function to each item from stdin */
    map: async function* (ctxt) {
      let { api, args, datum } = ctxt
      const func = Function(`return ${args[0]}`)()
      while ((datum = await api.read(true)) !== null) {
        if (datum.__chunk__) yield { ...datum, items: /** @type {any[]} */ (datum.items).map(x => func(x, ctxt)) }
        else yield func(datum, ctxt)
      }
    },
  
    poll: async function* ({ api, args }) {
      yield* api.poll(args)
    },
  
    /** Reduce all items from stdin */
    reduce: async function* ({ api, args, datum }) {
      const inputs = []
      const reducer = Function(`return ${args[0]}`)()
      while ((datum = await api.read()) !== null)
        inputs.push(datum)
      yield args[1]
        ? inputs.reduce(reducer, api.parseJsArg(args[1]))
        : inputs.reduce(reducer)
    },
  
    /**
     * Split arrays from stdin into items.
     * Split strings by optional separator (default `''`).
     * Otherwise ignore.
     */
    split: async function* ({ api, args, datum }) {
      const arg = args[0] || ""
      while ((datum = await api.read()) !== null) {
        if (datum instanceof Array) {
          // yield* datum
          yield { __chunk__: true, items: datum };
        } else if (typeof datum === "string") {
          // yield* datum.split(arg)
          yield { __chunk__: true, items: datum.split(arg) };
        }
      }
    },
  
    /** Collect stdin into a single array */
    sponge: async function* ({ api, datum }) {
      const outputs = []
      while ((datum = await api.read()) !== null)
        outputs.push(datum)
      yield outputs
    },
  
  },
  ];
  
  /**
   * Game shell functions which invoke a single builtin i.e. `run`.
   *
   * In particular, `foo: async function* (...) {...}` becomes
   * `foo() { run '(...) {...}'; }`
   *
   * @type {Record<string, (arg: RunArg) => void>[]}
   */
  const gameFunctionsRunDefs = [
  {
  
    /** Ping per second until query {WORLD_KEY} found */
    awaitWorld: async function* ({ api, home: { WORLD_KEY } }) {
      const ansiColor = api.getColors();
      const { sessionKey } = api.getProcess();
  
      /** @type {import('../world/World').State} */ let worldApi;
      while (!(worldApi = api.getCached(WORLD_KEY)) || !worldApi.isReady()) {
        api.info(`${ansiColor.White}polling for world ${ansiColor.Blue}${WORLD_KEY}${ansiColor.Reset}`)
        yield* api.sleep(1);
      }

      const { npcs } = worldApi;
      npcs.session[sessionKey] ||= { key: sessionKey, receiveMsgs: true, panzoomPids: [] };
      api.info(`${ansiColor.White}found world ${ansiColor.Blue}${WORLD_KEY}${ansiColor.Reset}`);
    },
    
    /**
     * Output world position clicks from panZoomApi.events, e.g.
     * - `click` forwards all clicks
     * - `click 1` forwards exactly one click, suppressing other `click`s
     */
    click: async function* ({ api, args, home }) {
      let [numClicks, extra] = args[0] === ""
        ? [Number.MAX_SAFE_INTEGER, null]
        : [Number(args[0]), { clickHash: api.getUid(), }]

      if (!Number.isFinite(numClicks)) {
        throw api.throwError("format: \`click [{numberOfClicks}]\`")
      }

      const { npcs, panZoom, lib } = api.getCached(home.WORLD_KEY)
      extra && panZoom.pointerUpExtras.push(extra); // Will be merged into next pointerup
      
      const process = api.getProcess()
      /** @type {import('rxjs').Subscription} */ let sub;
      process.cleanups.push(() => sub?.unsubscribe());

      while (numClicks > 0) {
        const e = await /** @type {Promise<PanZoom.CssPointerUpEvent>} */ (new Promise((resolve, reject) => {
          sub = panZoom.events.subscribe({ next(e) {
            if (e.key !== "pointerup" || e.distance > 5 || process.status !== 1) {
              return;
            }
            if (e.extra.clickHash && !extra) {
              return; // `click 1` overrides `click`
            }
            if (e.extra.clickHash ? (extra?.clickHash === e.extra.clickHash) : true) {
              resolve(e); // Must resolve before tear-down induced by unsubscribe 
              sub.unsubscribe();
            }
          }});
          sub.add(() => {
            panZoom.pointerUpExtras = panZoom.pointerUpExtras.filter(x => x !== extra); 
            reject(api.getKillError());
          });
        }));

        const meta = {...e.meta};
        if (npcs.isPointInNavmesh(e.point)) {
          meta.nav = true; // add "nav" tag
        }

        yield {
          x: lib.precision(e.point.x),
          y: lib.precision(e.point.y),
          meta,
        };

        numClicks--;
      }
    },

    // ℹ️ very similar to `walk`
    look: async function* ({ api, args, home, datum, promises = [] }) {
      const { npcs } = api.getCached(home.WORLD_KEY)
      const npcKey = args[0]
      
      npcs.handleLongRunningNpcProcess(api.getProcess(), npcKey);

      if (api.isTtyAt(0)) {
        const point = api.safeJsonParse(args[1])
        await npcs.npcAct({ action: "look-at", npcKey, point })
      } else {
        datum = await api.read()
        while (datum !== null) {
          await npcs.npcAct({ npcKey, action: "cancel" })
          // Subsequent reads can interrupt look
          const resolved = await Promise.race([
            promises[0] = npcs.npcAct({ action: "look-at", npcKey, point: datum }),
            promises[1] = api.read(),
          ])
          if (typeof resolved === "number") {// Finished look
            datum = await promises[1];
          } else if (resolved === null) {// EOF so finish look
            await promises[0]
            datum = resolved
          } else {// We read something before look finished
            await npcs.npcAct({ npcKey, action: "cancel" })
            datum = resolved
          }
        }
      }
    },
  
    /**
     * Request navpath(s) to position(s) for character(s), e.g.
     * ```sh
     * nav andros "$( click 1 )"
     * nav andros "$( click 1 )" --tryOpen
     * expr '{"npcKey":"andros","point":{"x":300,"y":300}}' | nav
     * expr '{"x":300,"y":300}' | nav andros --tryOpen
     * click | nav andros --tryOpen
     * ```
     */
    nav: async function* ({ api, args, home, datum }) {
      const { opts, operands } = api.getOpts(args, { boolean: [
        "tryOpen", /** Try to open doors */
      ]});

      const { npcs } = api.getCached(home.WORLD_KEY)
      if (api.isTtyAt(0)) {
        const npcKey = operands[0]
        const point = api.parseJsArg(operands[1])
        yield npcs.getNpcGlobalNav({ npcKey, point, tryOpen: opts.tryOpen })
      } else if (operands[0]) {
        const npcKey = operands[0]
        while ((datum = await api.read()) !== null)
          yield npcs.getNpcGlobalNav({ npcKey, point: datum, tryOpen: opts.tryOpen })
      } else {
        while ((datum = await api.read()) !== null)
          yield npcs.getNpcGlobalNav({ tryOpen: opts.tryOpen, ...datum })
      }
    },
  
    /** npc {action} [{opts}] [{args}] */
    npc: async function* ({ api, args, home, datum }) {
      /**
       * 🚧 Needs a refactor
       * - cleanup `events`
       * - cleanup `do`
       */
      const { doors, npcs, panZoom, lib } = api.getCached(home.WORLD_KEY);

      if (!args[0]) {
        throw api.throwError("first arg {action} must be a non-empty string");
      } else if (!npcs.service.isNpcActionKey(args[0])) {
        if (args[0] in npcs.npc) {
          // `npc {npcKey} [selector]` --> `npc get {npcKey} [selector]`
          args[2] = args[1], args[1] = args[0], args[0] = "get";
        } else {
          throw api.throwError("first arg {action} must be a valid key");
        }
      }

      const action = /** @type {NPC.NpcActionKey} */ (args[0]);
      const process = api.getProcess();

      // `npc events` yields > 1 output (potentially unbounded)
      if (action === "events") {// Never ends and must be killed (maybe implicitly)
        const asyncIterable = api.observableToAsyncIterable(lib.merge(
          doors.events,
          npcs.events,
          panZoom.events,
        ));
        // ℹ️ could not catch asyncIterable.throw?.(api.getKillError())
        process.cleanups.push(() => asyncIterable.return?.());
        for await (const event of asyncIterable) {
          if (process.status === 1) yield event;
        }
        // ℹ️ we only get here via `kill` or e.g. failed pipe-sibling
        throw api.getKillError();
      }

      let cleanLongRunning = /** @type {undefined | (() => void)} */ (undefined);

      if (api.isTtyAt(0)) {
        const opts = npcs.service.normalizeNpcCommandOpts(
          action,
          api.parseJsArg(args[1]),
          args.slice(2).map(arg => api.parseJsArg(arg)),
        );
        if (action === "do") {
          cleanLongRunning = npcs.handleLongRunningNpcProcess(process, /** @type {*} */ (opts.npcKey));
        }
        try {
          yield await npcs.npcAct({ action: /** @type {*} */ (action), ...opts });
        } catch (e) {
          if (!opts.suppressThrow) throw e;
        } finally {
          cleanLongRunning?.();
        }
      } else {
        /** e.g. `foo | npc do "{ suppressThrow: true }"`*/
        const baseOpts = api.parseJsArg(args[1]) || {};

        while ((datum = await api.read()) !== null) {
          if (action === "do") {
            const { npcKey } = /** @type {NPC.NpcAction & { action: 'do' }} */ (datum);
            cleanLongRunning = npcs.handleLongRunningNpcProcess(process, npcKey);
          }
          try {
            const opts = npcs.service.normalizeNpcCommandOpts(action, datum, []);
            yield await npcs.npcAct({ action: /** @type {*} */ (action), ...opts });
          } catch (e) {
            if (!baseOpts.suppressThrow) throw e;
          } finally {
            cleanLongRunning?.();
          }
        }
      }

    },
  
    /**
     * Spawn character(s) at a position(s) and angle, e.g.
     * - `spawn andros "$( click 1 )"`
     * - `spawn andros zhodani "$( click 1 )"`
     * - `expr '{"npcKey":"andros","point":{"x":300,"y":300}}' | spawn`
     * 
     * We also handle "do points": spawn _from_ do; spawn _to_ do.
     */
    spawn: async function* ({ api, args, home, datum }) {
      const { npcs } = api.getCached(home.WORLD_KEY);

      /**
       * @param {string} npcKey
       * @param {Geomorph.PointWithMeta} point
       * @param {NPC.NpcClassKey} [npcClassKey]
       */
      async function spawnOrDo(npcKey, point, npcClassKey) {
        const spawned = npcs.npc[npcKey];
        if (spawned?.doMeta) {// At do points delegate to `do`
          npcClassKey && spawned.changeClass(npcClassKey);
          await npcs.npcActDo({ npcKey, point, action: "do", fadeOutMs: 0, suppressThrow: true });
        } else {
          await npcs.spawn({ npcKey, point, npcClassKey });
          if (point.meta?.do) {// Going to `do`
            await npcs.npcActDo({ npcKey, point, action: "do", fadeOutMs: 0 });
          }
        }
      }

      if (api.isTtyAt(0)) {
        const npcKey = args[0];
        const threeArgs = args.length === 3;
        const npcClassKey = threeArgs ? /** @type {NPC.NpcClassKey} */ (args[1]) : undefined;
        const point = api.parseJsArg(args[threeArgs ? 2 : 1]);
        point.meta ??= {};
        await spawnOrDo(npcKey, point, npcClassKey);
      } else {
        while ((datum = await api.read()) !== null) {// datum: { npcKey, [npcClassKey], point }
          await spawnOrDo(datum.npcKey, datum.point, datum.npcClassKey);
        }
      }
    },
  
    /**
     * Track npc
     */
    track: async function* ({ api, args, home }) {
      const npcKey = args[0]
      const { npcs, lib } = api.getCached(home.WORLD_KEY)
      const process = api.getProcess()
      const subscription = npcs.trackNpc({ npcKey, process })
      const connected = npcs.session[api.meta.sessionKey];
      
      connected?.panzoomPids.push(api.meta.pid);
      // resolve on unsubscribe or invoke cleanups
      await /** @type {Promise<void>} */ (new Promise(resolve => {
        subscription.add(resolve);
        process.cleanups.push(() => subscription.unsubscribe(), resolve);
      }))
      connected && lib.removeFirst(connected.panzoomPids, api.meta.pid);
    },
  
    /**
     * - view {seconds} [{point}] [{zoom}]
     * - view `{ ms?: number; point?: Geom.VectJson, zoom?: number }`
     */
    view: async function* ({ api, args, home }) {
      const [first, second, third] = args.map(api.parseJsArg);
      const { npcs, panZoom, lib } = api.getCached(home.WORLD_KEY);
      const connected = npcs.session[api.meta.sessionKey];
      
      connected?.panzoomPids.push(api.meta.pid);
      api.addSuspend(() => { panZoom.animationAction("pause"); return true; });
      api.addResume(() => { panZoom.animationAction("play"); return true; });
      api.addCleanup(() => panZoom.animationAction("cancel"));
      await npcs.panZoomTo(typeof first === "number"
        ? {
            ms: first * 1000,
            point: typeof second === "number" ? undefined : second,
            zoom: typeof second === "number" ? second : third,
          }
        : first,
      );
      connected && lib.removeFirst(connected.panzoomPids, api.meta.pid);
    },
  
    /**
     * Move a specific npc along a @see {NPC.GlobalNavPath} <br/>
     * - e.g. `nav andros $( click 1) | walk andros`
     * - e.g. `nav andros $( click 1) > navPath; walk andros "$navPath"`
     * - `npcKey` must be fixed via 1st arg
     * - piped navPaths cancel previous
     */
    walk: async function* ({ api, args, home, datum, promises = [] }) {
      const { opts, operands } = api.getOpts(args, { boolean: [
        "open", /** Try to open doors */
      ]});
      const { npcs } = api.getCached(home.WORLD_KEY)
      const npcKey = operands[0]
  
      npcs.handleLongRunningNpcProcess(api.getProcess(), npcKey);
  
      if (api.isTtyAt(0)) {
        const navPath = /** @type {NPC.GlobalNavPath} */ (api.parseJsArg(operands[1]));
        await npcs.walkNpc({ npcKey, navPath, open: opts.open });
      } else {// `walk {npcKey}` expects to read global navPaths
        datum = await api.read()
        while (datum !== null) {
          const navPath = /** @type {NPC.GlobalNavPath} */ (datum);
          // Cancel before walking (interrupt other processes)
          // But avoid cancel on empty-paths (do not interrupt other processes)
          navPath.fullPath.length > 0 && await npcs.npcAct({ npcKey, action: "cancel" })
          // Subsequent reads can interrupt walk
          const resolved = await Promise.race([
            promises[0] = npcs.walkNpc({ npcKey, navPath, open: opts.open }),
            promises[1] = api.read(),
          ])
          if (resolved === undefined) {// Finished walk
            datum = await promises[1]
          } else if (resolved === null) {// EOF so finish walk
            await promises[0]
            datum = resolved
          } else {// We read something before walk finished
            await npcs.npcAct({ npcKey, action: "cancel" })
            datum = resolved
          }
        }
      }
    },
  
  },
  ];
  
  //#endregion
  
  /**
   * Convert functions into shell function bodies
   */
  utilFunctionsRunDefs.forEach((defs, i) =>
    Object.entries(defs).forEach(
      //@ts-ignore
      ([key, fn]) => (utilFunctions[i] = utilFunctions[i] || [])[key] = wrap(fn),
    )
  );
  gameFunctionsRunDefs.forEach((defs, i) =>
    Object.entries(defs).forEach(
      //@ts-ignore
      ([key, fn]) => (gameFunctions[i] = gameFunctions[i] || [])[key] = wrap(fn),
    )
  );
  
  /** @param {(arg: { api: any; args: string[]; }) => any} fn */
  function wrap(fn) {
    return `{
      run '${fnToSuffix(fn)}' "$@"
}`
  }
  
  /**
   * We assume the input is an anonymous function.
   * @param {(arg: { api: any; args: string[]; }) => any} fn
   */
  function fnToSuffix(fn) {
    switch (fn.constructor.name) {
      case "GeneratorFunction":
        return `${fn}`.slice("function* ".length)
      case "AsyncGeneratorFunction":
        return `${fn}`.slice("async function* ".length)
      default:
        return `${fn}`.slice("function ".length);
    }
  }
  