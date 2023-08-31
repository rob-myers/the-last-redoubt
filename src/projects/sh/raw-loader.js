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
      const func = api.generateSelector(
        api.parseFnOrStr(args[0]),
        args.slice(1).map(x => api.parseJsArg(x)),
      );
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
      const func = api.generateSelector(
        api.parseFnOrStr(args[0]),
        args.slice(1).map(x => api.parseJsArg(x)),
      );
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
  
    take: async function* ({ api, args, datum }) {
      let remainder = Number(args[0] || Number.POSITIVE_INFINITY)
      while ((remainder-- > 0) && ((datum = await api.read(true)) !== null))
        if (datum.__chunk__) {
          let items = datum.items.slice(0, remainder + 1)
          remainder -= (items.length - 1)
          yield* items 
        } else {
          yield datum
        }
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
      /** @type {{ clickHash?: string }} */
      const extra = args[0] ? { clickHash: api.getUid() } : {}
      let numClicks = Number(args[0] || Number.MAX_SAFE_INTEGER);

      if (!Number.isFinite(numClicks)) {
        throw api.throwError("format: \`click [{numberOfClicks}]\`")
      }
      
      const process = api.getProcess()
      /** @type {import('rxjs').Subscription} */ let sub;
      process.cleanups.push(() => sub?.unsubscribe());

      const worldApi = api.getCached(home.WORLD_KEY)
      while (numClicks > 0) {
        worldApi.panZoom.pointerUpExtras.push(extra); // merged into next pointerup
        
        const e = await /** @type {Promise<PanZoom.CssPointerUpEvent>} */ (new Promise((resolve, reject) => {
          sub = worldApi.panZoom.events.subscribe({ next(e) {
            if (e.key !== "pointerup" || e.distance > 5 || process.status !== 1) {
              return;
            }
            if (e.extra.clickHash && !extra.clickHash) {
              return; // `click 1` overrides `click`
            }
            if (e.extra.clickHash && extra.clickHash !== e.extra.clickHash) {
              return; // later `click {n}` overrides earlier `click {n}`
            }
            resolve(e); // Must resolve before tear-down induced by unsubscribe 
            sub.unsubscribe();
          }});
          sub.add(() => {
            worldApi.panZoom.pointerUpExtras = worldApi.panZoom.pointerUpExtras.filter(x => x !== extra);
            reject(api.getKillError());
          });
        }));

        const gmRoomId = worldApi.gmGraph.findRoomContaining(e.point);
        const meta = /** @type {Geomorph.PointMeta} */ ({ ...e.meta, ...gmRoomId ?? { roomId: null } });
        meta.nav = worldApi.npcs.isPointInNavmesh(e.point); // add "nav" tag

        yield {
          x: worldApi.lib.precision(e.point.x),
          y: worldApi.lib.precision(e.point.y),
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
        const point = api.parseJsArg(args[1])
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
          if (resolved === undefined) {// Finished look
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
     * nav rob "$( click 1 )"
     * nav $( click 3 )
     * expr '{"x":300,"y":300}' | nav rob
     * click | nav rob
     * click | nav --to rob
     * ```
     */
    nav: async function* ({ api, args, home, datum }) {
      const { opts, operands } = api.getOpts(args, {
        boolean: [
          "exactNpc", /** Require navigable npcs (otherwise use nearest navigable) */
          "preferOpen", /** Prefer open doors i.e. --closed=10000 */
          "safeLoop", /** Pipe mode NOOPs if path non-navigable */
          "to",   /** Piped input goes before operands (else after) */
        ],
        string: [
          "closed", /** Weight nav nodes near closed doors, e.g. 10000 */
          "locked", /** Weight nav nodes near locked doors, e.g. 10000 */
          "name", /** Created DecorPath has this key */
        ],
      })
      const { npcs, lib, gmGraph, debug } = api.getCached(home.WORLD_KEY)

      if (operands.length < (api.isTtyAt(0) ? 2 : 1)) {
        throw Error("not enough points");
      }

      /** @type {NPC.NavOpts} */
      const navOpts = {
        ...opts.preferOpen && { closedWeight: 10000 },
        ...opts.closed && { closedWeight: Number(opts.closed) ?? undefined },
        ...opts.locked && { lockedWeight: Number(opts.locked) ?? undefined },
      };

      /** @param {any[]} parsedArgs */
      const parsePoints = (parsedArgs) => parsedArgs.map((parsed) =>
        npcs.parsePointRep(parsed, opts.exactNpc)
      );
      
      /** @param {Geom.VectJson[]} points  */
      function computeNavPath(points) {
        // We guarded earlier by `isPointInNavmesh`; centroidsFallback should help catch edge cases.
        const navPaths = points.slice(1).map((point, i) =>
          npcs.getGlobalNavPath(points[i], point, {...navOpts, centroidsFallback: true }),
        );
        const navPath = npcs.service.concatenateNavPaths(navPaths, {
          name: typeof api.parseJsArg(operands[0]) === "string" ? `navpath-${operands[0]}` : undefined,
        });
        debug.addPath(navPath);
        return navPath;
      }

      const parsedArgs = operands.map(operand => api.parseJsArg(operand));
      
      if (api.isTtyAt(0)) {
        yield computeNavPath(parsePoints(parsedArgs));
      } else {
        while ((datum = await api.read()) !== null) {
          try {
            yield computeNavPath(parsePoints(opts.to ? [datum].concat(parsedArgs) : parsedArgs.concat(datum)));
          } catch (e) {// 🚧 swallows other errors?
            if (!opts.safeLoop) throw e;
          }
        }
      }
    },
  
    /**
     * npc {action} [opts] [extras[i]]
     * npc --safeLoop {action} [opts] [extras[i]]
     */
    npc: async function* ({ api, args, home, datum }) {
      const { opts, operands } = api.getOpts(args, { boolean: [
        "safeLoop", /** Pipe mode NOOPs rather than throwing */
      ]});

      const worldApi = api.getCached(home.WORLD_KEY);
      const { npcs } = worldApi;

      if (!npcs.service.isNpcActionKey(operands[0])) {
        if (operands[0] in npcs.npc) {
          // `npc {npcKey} [selector] [args]*` --> `npc get {npcKey} [selector] [args]*`
          operands.unshift("get");
        } else {
          throw api.throwError(`${operands[0]}: invalid action`);
        }
      }

      const action = /** @type {NPC.NpcActionKey} */ (operands[0]);
      const process = api.getProcess();
      let cleanLongRunning = /** @type {undefined | (() => void)} */ (undefined);

      if (action === "events") {
        return yield* npcs.service.yieldEvents(worldApi, api);
      }

      if (api.isTtyAt(0)) {
        try {
          const npcAct = npcs.service.normalizeNpcCommandOpts(
            action,
            api.parseJsArg(operands[1]),
            operands.slice(2).map(arg => api.parseJsArg(arg)),
          );
          if (npcAct.action === "do" || npcAct.action === "look-at") {
            cleanLongRunning = npcs.handleLongRunningNpcProcess(process, npcAct.npcKey);
          }
          yield await npcs.npcAct(npcAct);
        } finally {
          cleanLongRunning?.();
        }
      } else {
        while ((datum = await api.read()) !== null) {
          try {
            const npcAct = operands.length === 1
              ? npcs.service.normalizeNpcCommandOpts(action, datum, [])
              // support initial operand e.g. `click | npc look-at {npcKey}`
              : npcs.service.normalizeNpcCommandOpts(action, operands[1], [...operands.slice(2), datum])
            ;
            if (npcAct.action === "do" || npcAct.action === "look-at") {
              cleanLongRunning = npcs.handleLongRunningNpcProcess(process, npcAct.npcKey);
            }
            yield await npcs.npcAct(npcAct);
          } catch (e) {
            if (!opts.safeLoop) throw e;
          } finally {
            cleanLongRunning?.();
          }
        }
      }

    },
  
    controlNpc: async function* ({ api, args, home }) {
      // 🚧 clean
      // 🚧 warp on longClick
      const w = api.getCached(home.WORLD_KEY)
      const npcKey = args[0];
      const npc = w.npcs.getNpc(npcKey);
      let datum = /** @type {Geomorph.PointWithMeta | null} */ (null);
      
      w.npcs.handleLongRunningNpcProcess(api.getProcess(), npcKey);

      while ((datum = await api.read()) !== null) {
        try {
          const { meta } = datum;

          if (meta.npc && meta.npcKey === npcKey) {
            // think
            w.fov.mapAct("show-for-ms", 3000);
          } else if (meta.nav && !meta.ui && !meta.do && !meta.longClick && !npc.doMeta) {
            // walk
            const src = w.npcs.parsePointRep(npcKey, true); 
            const navPath = w.npcs.getGlobalNavPath(src, datum, {
              closedWeight: 10000,
              centroidsFallback: true,
            });
            w.debug.addPath(navPath);
            await w.npcs.npcAct({ npcKey, action: "cancel" })
            w.npcs.walkNpc(npcKey, navPath, { doorStrategy: "none" });
          } else if (meta.do || meta.door || (npc.doMeta && meta.nav)) {
            // do
            await w.npcs.npcAct({ npcKey, action: "cancel" });
            await w.npcs.npcActDo({
              action: "do",
              npcKey,
              point: datum,
              // suppressThrow: true,
            });
          } else if (!meta.nav) {
            // look
            await w.npcs.npcAct({ npcKey, action: "cancel" });
            w.npcs.npcAct({ action: "look-at", npcKey, point: datum });
          } else {
            continue;
          }
        } catch (e) {
          api.info(`${e}`);
        }
      }
    },

    /**
     * Spawn character(s) at a position(s) and angle, e.g.
     * - `spawn rob "$( click 1 )"`
     * - `spawn rob --zhodani "$( click 1 )"`
     * - `spawn rob --class=zhodani "$( click 1 )"`
     * - `expr '{"npcKey":"rob","point":{"x":300,"y":300}}' | spawn`
     * - `expr '{"npcKey":"rob","class":"zhodani","point":{"x":300,"y":300}}' | spawn`
     * 
     * We also handle "do points": spawn _from_ do; spawn _to_ do.
     */
    spawn: async function* ({ api, args, home, datum }) {
      const { opts, operands } = api.getOpts(args, {
        string: [
          "class", /** e.g. solomani, vilani, zhodani */
        ],
        boolean: [
          "--solomani", "--vilani", "--zhodani", /** shortcuts */
        ],
      });

      const { npcs } = api.getCached(home.WORLD_KEY);
      const npcClassKey = opts.class || (
        opts.solomani && "solomani"
        || opts.vilani && "vilani"
        || opts.zhodani && "zhodani"
        || undefined
      );
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
        const npcKey = operands[0];
        const point = api.parseJsArg(operands[1]);
        point.meta ??= {};
        await spawnOrDo(npcKey, point, npcClassKey);
      } else {
        while ((datum = await api.read()) !== null) {
          await spawnOrDo(datum.npcKey, datum.point, datum.class ?? npcClassKey);
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

      api.addResume(() => {
        npcs.events.next({ key: "resumed-track", npcKey });
        return true;
      });

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
     * - e.g. `nav rob $( click 1) | walk rob`
     * - e.g. `nav rob $( click 1) > navPath; walk rob "$navPath"`
     * - `npcKey` must be fixed via 1st arg
     * - piped navPaths cancel previous
     */
    walk: async function* ({ api, args, home, datum, promises = [] }) {
      const { opts, operands } = api.getOpts(args, { boolean: [
        "open",       /** Try to open doors */
        "safeOpen",   /** Do not approach locked doors without key */
        "forceOpen",  /** Open all doors (as if had skeleton key) */
      ]});
      const { npcs } = api.getCached(home.WORLD_KEY)
      const npcKey = operands[0]
  
      npcs.handleLongRunningNpcProcess(api.getProcess(), npcKey);

      /** @type {NPC.WalkDoorStrategy} */
      let doorStrategy = "none";
      opts.open && (doorStrategy = "open");
      opts.safeOpen && (doorStrategy = "safeOpen");
      opts.forceOpen && (doorStrategy = "forceOpen");
      
      if (api.isTtyAt(0)) {
        const navPath = /** @type {NPC.GlobalNavPath} */ (api.parseJsArg(operands[1]));
        await npcs.walkNpc(npcKey, navPath, { doorStrategy });
      } else {// `walk {npcKey}` expects to read global navPaths
        datum = await api.read()
        while (datum !== null) {
          const navPath = /** @type {NPC.GlobalNavPath} */ (datum);
          // Cancel before walking (interrupt other processes)
          // But avoid cancel on empty-paths (do not interrupt other processes)
          navPath.path.length > 0 && await npcs.npcAct({ npcKey, action: "cancel" })
          // Subsequent reads can interrupt walk
          const resolved = await Promise.race([
            promises[0] = npcs.walkNpc(npcKey, navPath, { doorStrategy }),
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
  