/* eslint-disable no-undef */
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
   * Definitions of game shell function based on builtin `run`.
   *
   * @type {Record<string, (arg: RunArg) => void>[]}
   */
  const gameFunctionsRunDefs = [
  {
  
    /** Ping per second until query WORLD_KEY found */
    'await-world': async function* ({ api, home: { WORLD_KEY } }) {
      const ansiColor = api.getColors();
      const { sessionKey } = api.getProcess();
  
      /** @type {import('../world/World').State} */ let worldApi;
      while (!(worldApi = api.getCached(WORLD_KEY)) || !worldApi.isReady()) {
        api.info(`polling for cached query ${ansiColor.Blue}${WORLD_KEY}${ansiColor.White}`)
        yield* api.sleep(1);
      }

      const { npcs } = worldApi;
      if (!npcs.session[sessionKey]) {
        npcs.session[sessionKey] = { key: sessionKey, receiveMsgs: true, tty: {} };
      }
      api.info(`found cached query ${ansiColor.Blue}${WORLD_KEY}${ansiColor.White}`);
    },
    
    /**
     * Output world position clicks from panZoomApi.events, e.g.
     * - `click` forwards all clicks
     * - `click 1` forwards exactly one click, suppressing other `click`s
     * 
     * Our approach via `otag` is relatively efficient.
     * Otherwise we'd have to keep creating short-term subscriptions.
     */
    click: async function* ({ api, args, home }) {
      const numClicks = args[0] === "" ? Number.MAX_SAFE_INTEGER : Number(args[0])
      const extra = args[0] === "" ? null : { clickEpoch: Date.now() };
      if (!Number.isFinite(numClicks)) {
        api.throwError("format: \`click [{numberOfClicks}] [!]\`")
      }

      const { lib, npcs, panZoom } = api.getCached(home.WORLD_KEY)
      const process = api.getProcess()
      extra && panZoom.pointerUpExtras.push(extra);
      
      yield* lib.otag(
        panZoom.events.pipe(
          lib.filter(
            /**
             * @type {function(*): x is PanZoom.CssPointerUpEvent}
             * @param {PanZoom.CssInternalEvent} x 
             */
            x => x.key === "pointerup" && x.distance < 5 && process.status === 1 && (
              x.extra.clickEpoch ? !!extra && (extra.clickEpoch === x.extra.clickEpoch) : true
          )),
          lib.take(numClicks),
          lib.map((e) => ({
            x: Number(e.point.x.toFixed(2)),
            y: Number(e.point.y.toFixed(2)),
            tags: [...e.tags, ...npcs.getPointTags(e.point)],
          })),
        ),
        (deferred, subscription) => {
          process.cleanups.push(
            () => deferred.promise.reject(api.getKillError()),
            () => subscription.unsubscribe(),
          ); // This teardown amounts to a `finally { ... }`
          subscription.add(() => panZoom.pointerUpExtras = panZoom.pointerUpExtras.filter(x => x !== extra));
        },
      )
    },
  
    look: async function* ({ api, args, datum, home }) {
      const { npcs } = api.getCached(home.WORLD_KEY)
      const npcKey = args[0]
      if (api.isTtyAt(0)) {
        const point = api.safeJsonParse(args[1])
        await npcs.npcAct({ action: "look-at", npcKey, point })
      } else {
        while ((datum = await api.read()) !== null) {
          await npcs.npcAct({ action: "look-at", npcKey, point: datum })
        }
      }
    },
  
    /**
     * Request navpath(s) to position(s) for character(s),
     * - e.g. `nav andros "$( click 1 )"'
     * - e.g. `expr '{"npcKey":"andros","point":{"x":300,"y":300}}' | nav`
     * - e.g. `click | map 'x => ({ npcKey: "andros", point: x })' | nav`
     */
    nav: async function* ({ api, args, home, datum }) {
      const { npcs } = api.getCached(home.WORLD_KEY)
      if (api.isTtyAt(0)) {
        const npcKey = args[0]
        const point = api.safeJsonParse(args[1])
        yield npcs.getNpcGlobalNav({ npcKey, point })
      } else {
        while ((datum = await api.read()) !== null) {
          try {
            yield npcs.getNpcGlobalNav({ debug: home.DEBUG === "true", ...datum })
          } catch (e) {
            api.info(`${e}`)
            console.error(e)
          }
        }
      }
    },
  
    /** npc {action} [{opts}] */
    npc: async function* ({ api, args, home }) {
      const { npcs } = api.getCached(home.WORLD_KEY)
      const action = args[0]
      let opts = api.parseJsArg(args[1]);

      if (typeof opts === "string") {
        ["add-decor", "remove-decor", "rm-decor"].includes(action) && (opts = { decorKey: opts });
        ["cancel", "get", "pause", "play", "set-player"].includes(action) && (opts = { npcKey: opts });
      }
      if (action === "config") {
        opts = { ...{ debug: !!home.DEBUG }, ...opts };
      }

      yield await npcs.npcAct({ action, ...opts })
    },
  
    /**
     * Spawn character(s) at a position(s) and angle,
     * - e.g. `spawn andros "$( click 1 )"
     * - e.g. `spawn andros "$( click 1 )" "$( call '() => Math.PI/2' )"`
     * - e.g. `expr '{"npcKey":"andros","point":{"x":300,"y":300}}' | spawn`
     */
    spawn: async function* ({ api, args, home, datum }) {
      const { npcs } = api.getCached(home.WORLD_KEY)
      if (api.isTtyAt(0)) {
        const npcKey = args[0]
        const point = api.safeJsonParse(args[1])
        const angle = Number(args[2]) || 0
        await npcs.spawn({ npcKey, point, angle })
      } else {
        while ((datum = await api.read()) !== null)
          await npcs.spawn(datum)
      }
    },
  
    /**
     * Track npc
     */
    track: async function* ({ api, args, home }) {
      const npcKey = args[0]
      const { npcs } = api.getCached(home.WORLD_KEY)
      const process = api.getProcess()
      const subscription = npcs.trackNpc({ npcKey, process })
      await /** @type {Promise<void>} */ (new Promise(resolve =>
        process.cleanups.push(
          () => subscription.unsubscribe(),
          resolve,
        )
      ))
    },
  
    /**
     * TODO handle multiple reads?
     */
    view: function* ({ api, args, home }) {
      const opts = Function(`return ${args[0]} `)()
      const { npcs } = api.getCached(home.WORLD_KEY)
      npcs.panZoomTo(opts) // Returns "cancelled" or "completed"
    },
  
    /**
     * Move a specific npc along path(s) e.g.
     * - `walk andros "[$( click 1 ), $( click 1 )]"`
     * - `expr "{ key: 'global-nav', fullPath: [$( click 1 ), $( click 1 )], navMetas: [] }" | walk andros`
     * - `nav andros $( click 1) | walk andros`
     *
     * `npcKey` must be fixed via 1st arg
     */
    walk: async function* ({ api, args, home, datum, promises = [] }) {
      const { npcs } = api.getCached(home.WORLD_KEY)
      const npcKey = args[0]
  
      const process = api.getProcess()
      process.cleanups.push(() => npcs.npcAct({ npcKey, action: "cancel" }).catch(_e => {}))
      process.onSuspends.push(() => { npcs.npcAct({ npcKey, action: "pause" }); return true; })
      process.onResumes.push(() => { npcs.npcAct({ npcKey, action: "play" }); return true; })
  
      if (api.isTtyAt(0)) {
        const points = api.safeJsonParse(args[1])
        await npcs.walkNpc({ npcKey, key: "global-nav", fullPath: points, navMetas: [] })
      } else {
        datum = await api.read()
        while (datum !== null) {
          // Subsequent reads can interrupt walk
          const resolved = await Promise.race([
            promises[0] = npcs.walkNpc({ npcKey, ...datum }),
            promises[1] = api.read(),
          ])
          if (resolved === undefined) {// Finished walk
            datum = await promises[1];
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
      case 'GeneratorFunction':
        return `${fn}`.slice('function* '.length)
      case 'AsyncGeneratorFunction':
        return `${fn}`.slice('async function* '.length)
      default:
        return `${fn}`.slice('function '.length);
    }
  }
  