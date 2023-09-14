/* eslint-disable no-undef, no-useless-escape, require-yield, @typescript-eslint/ban-ts-comment */
/**
 *  ℹ️ This file is loaded via webpack `raw-loader` to avoid function transpilation.
 * 🔔🔔🔔🔔 We MUST avoid single-quotes ANYWHERE inside function bodies 🔔🔔🔔🔔
 *
 * `utilFunctions` is provided by the context
 * > We'll extend it using @see utilFunctionsRunDefs
 * > They are both arrays in order to support future versions of the named functions.
 * 
 * `gameFunctions` is provided by the context
 * > We'll extend it using @see gameFunctionsRunDefs
 */

//#region defs

/**
 * @typedef RunArg @type {object}
 * @property {import('./cmd.service').CmdService['processApi'] & { getCached(key: '__WORLD_KEY_VALUE__'): import('../world/World').State }} api
 * @property {string[]} args
 * @property {{ [key: string]: any; 'WORLD_KEY': '__WORLD_KEY_VALUE__'; }} home
 * @property {*} [datum] A shortcut for declaring a variable
 */

  /**
   * Util shell functions which invoke a single builtin: `run`.
   *
   * In particular,
   * > `foo: async function* (...) {...}`
   * 
   * becomes:
   * > `foo() { run '(...) {...}' "$@"; }`
   *
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
   * Game shell functions which invoke a single builtin: `run`.
   *
   * In particular,
   * > `foo: async function* (...) {...}`
   * 
   * becomes:
   * > `foo() { run '(...) {...}' "$@"; }`
   *
   * @type {Record<string, (arg: RunArg) => void>[]}
   */
  const gameFunctionsRunDefs = [
  {
  
    /** Ping per second until query {WORLD_KEY} found */
    awaitWorld: async function* ({ api, home: { WORLD_KEY } }) {
      while (!api.getCached(WORLD_KEY)?.isReady()) {
        api.info(`polling for world ${api.ansi.White}${WORLD_KEY}`)
        yield* api.sleep(1)
      }
      api.getCached(WORLD_KEY).npcs.connectSession(api.meta.sessionKey)
      api.info(`found world ${api.ansi.White}${WORLD_KEY}`)
    },
    
    /**
     * Output world position clicks from panZoomApi.events, e.g.
     * - `click` forwards all clicks
     * - `click 1` forwards exactly one click suppressing other `click [{n}]`s
     */
    click: async function* ({ api, args, home }) {
      let numClicks = Number(args[0] || Number.MAX_SAFE_INTEGER),
        /** @type {import('rxjs').Subscription} */ eventsSub;
      const clickId = args[0] ? api.getUid() : undefined;
      if (!Number.isFinite(numClicks)) {
        throw api.throwError("format: \`click [{numberOfClicks}]\`")
      }
      
      const w = api.getCached(home.WORLD_KEY)
      api.addCleanup(() => eventsSub?.unsubscribe())
      clickId && api.addCleanup(() => w.lib.removeFirst(w.panZoom.clickIds, clickId));

      while (numClicks-- > 0) {
        clickId && w.panZoom.clickIds.push(clickId);
        
        const e = await /** @type {Promise<PanZoom.CssPointerUpEvent>} */ (new Promise((resolve, reject) => {
          eventsSub = w.panZoom.events.subscribe({ next(e) {
            if (e.key !== "pointerup" || e.meta.distance > 5 || !api.isRunning()) {
              return;
            } else if (e.clickId && !clickId) {
              return; // `click {n}` overrides `click`
            } else if (e.clickId && clickId !== e.clickId) {
              return; // later `click {n}` overrides earlier `click {n}`
            }
            resolve(e); // Must resolve before tear-down induced by unsubscribe 
            eventsSub.unsubscribe();
          }});
          eventsSub.add(() => reject(api.getKillError()));
        }));

        yield {
          x: w.lib.precision(e.point.x),
          y: w.lib.precision(e.point.y),
          meta: { ...e.meta,
            ...w.gmGraph.findRoomContaining(e.point) ?? { roomId: null },
            nav: w.npcs.isPointInNavmesh(e.point),
          },
        };
      }
    },

    look: async function* ({ api, args: [npcKey, pointStr], home, datum }) {
      const w = api.getCached(home.WORLD_KEY)
      const npc = w.npcs.handleLongRunningNpcProcess(api, npcKey);

      if (api.isTtyAt(0)) {
        await npc.lookAt(api.parseJsArg(pointStr));
      } else {
        let promise = Promise.resolve(/** @type {*} */ (0));
        while ((datum = await api.read()) !== null) {
          promise = npc.lookAt(datum);
        }
        await promise; // After EOF
      }
    },
  
    /**
     * Request navpath to position(s) or npc(s), e.g.
     * ```sh
     * nav $( click 2 )
     * click 2 | sponge | nav
     * nav rob "$( click 1 )"
     * nav $( click 4 )
     * expr '{x:300,y:300}' | nav rob
     * click | nav rob foo
     * ```
     */
    nav: async function* ({ api, args, home, datum }) {
      const { opts, operands } = api.getOpts(args, {
        string: [
          "closed", /** Weight nav nodes near closed doors, e.g. 10000 */
          "locked", /** Weight nav nodes near locked doors, e.g. 10000 */
          "name", /** Can override navPath.name and debug.path[key] */
        ],
      })
      /** @type {NPC.NavOpts} */
      const navOpts = {
        closedWeight: 10000, // Prefer open doors e.g. when doorStrategy `none`
        ...opts.closed && { closedWeight: Number(opts.closed) ?? undefined },
        ...opts.locked && { lockedWeight: Number(opts.locked) ?? undefined },
      };
      
      const w = api.getCached(home.WORLD_KEY)
      const parsedArgs = operands.map(operand => api.parseJsArg(operand));
      
      /** @param {(string | Geom.VectJson)[]} inputs  */
      function computeNavPath(inputs) {
        const points = inputs.map(w.npcs.parseNavigable);
        const navPaths = points.slice(1).map((point, i) =>
          w.npcs.getGlobalNavPath(points[i], point, { ...navOpts, centroidsFallback: true }),
        );
        const navPath = w.npcs.svc.concatenateNavPaths(navPaths);
        navPath.name = opts.name || w.npcs.svc.getNavPathName(inputs.length >= 2 ? inputs[0] : undefined);
        w.debug.addPath(navPath);
        return navPath;
      }
      
      if (api.isTtyAt(0)) {
        yield computeNavPath(parsedArgs);
      } else {
        while ((datum = await api.read()) !== null) {
          yield computeNavPath(parsedArgs.concat(datum));
        }
      }
    },
  
    /**
     * npc {action} [opts] [extras[i]]
     * ```sh
     * npc do rob $( click 1 )
     * click | npc do rob
     * ```
     */
    npc: async function* ({ api, args, home, datum }) {
      const w = api.getCached(home.WORLD_KEY);

      if (!w.npcs.svc.isNpcActionKey(args[0])) {
        if (args[0] in w.npcs.npc) {
          // `npc {npcKey} ...` --> `npc get {npcKey} ...`
          args.unshift("get");
        } else {
          throw api.throwError(`${args[0]}: invalid action`);
        }
      }

      const action = /** @type {NPC.NpcActionKey} */ (args[0]);
      if (action === "events") {
        return yield* w.npcs.svc.yieldEvents(w, api);
      }

      if (api.isTtyAt(0)) {
        const npcAct = w.npcs.svc.normalizeNpcCommandOpts(
          action,
          api.parseJsArg(args[1]),
          args.slice(2).map(arg => api.parseJsArg(arg)),
        );
        yield await w.npcs.npcAct(npcAct);
      } else {
        /** @param {*} e */
        const onError = e => void (w.npcs.config.verbose && api.info(`ignored: ${e}`));
        while ((datum = await api.read()) !== null) {
          const npcAct = args.length === 1
            ? w.npcs.svc.normalizeNpcCommandOpts(action, datum, [])
            : w.npcs.svc.normalizeNpcCommandOpts(action, args[1], [...args.slice(2), datum])
          ;
          yield await w.npcs.npcAct(npcAct).catch(onError);
        }
      }

    },
  
    controlNpc: async function* ({ api, args, home }) {
      const w = api.getCached(home.WORLD_KEY)
      const npcKey = args[0];
      const npc = w.npcs.getNpc(npcKey);
      // Do not use returned `npc` (we handle pausing differently)
      w.npcs.handleLongRunningNpcProcess(api, npcKey);
      
      /** @param {*} e */
      const onError = e => void (w.npcs.config.verbose && api.info(`ignored: ${e}`));
      let datum = /** @type {Geomorph.PointWithMeta | null} */ (null);

      while ((datum = await api.read()) !== null) {
        const { meta } = (datum);
        if (meta.npc && meta.npcKey === npcKey) {// Clicked npc
          if (meta.longClick) w.fov.mapAct("show-for-ms", 3000);
          else if (npc.manuallyPaused) npc.resume();
          else npc.pause();
          continue;
        } else if (npc.manuallyPaused) {
          continue;
        }

        if (meta.do || meta.door || (npc.doMeta && meta.nav)) {// do
          !meta.door && await npc.cancel();
          await npc.do(datum).catch(onError);
        } else if (meta.nav && !meta.ui) {
          await npc.cancel();
          const position = npc.getPosition();
          if (meta.longClick || !w.npcs.isPointInNavmesh(position)) {
            if (w.npcs.canSee(position, datum, npc.getInteractRadius())) {
              await npc.fadeSpawn(datum).catch(onError); // warp
            }
          } else {// walk
            const navPath = w.npcs.getGlobalNavPath(position, datum, {
              closedWeight: 10000,
              centroidsFallback: true,
            });
            navPath.name = w.npcs.svc.getNavPathName(npcKey);
            w.debug.addPath(navPath);
            npc.walk(navPath, { doorStrategy: "none" });
          }
        } else {// look
          await npc.cancel();
          npc.lookAt(datum).catch(onError);
        }
      }
    },

    /**
     * Spawn character(s) at a position(s) and angle, e.g.
     * - `spawn rob "$( click 1 )"`
     * - `spawn rob --zhodani "$( click 1 )"`
     * - `spawn rob --class=zhodani "$( click 1 )"`
     * - `expr '{"npcKey":"rob","point":{"x":300,"y":300}}' | spawn`
     * - `expr '{"npcKey":"rob","classKey":"zhodani","point":{"x":300,"y":300}}' | spawn`
     * 
     * We also handle "do points": spawn _from_ do; spawn _to_ do.
     */
    spawn: async function* ({ api, args, home, datum }) {
      const { opts, operands: [npcKey, pointStr] } = api.getOpts(args, {
        boolean: ["--solomani", "--vilani", "--zhodani", /** class */],
      });
      const npcClassKey = (
        opts.solomani && "solomani"
        || opts.vilani && "vilani"
        || opts.zhodani && "zhodani"
        || undefined
      );
      const w = api.getCached(home.WORLD_KEY);

      /**
       * @param {string} npcKey
       * @param {Geomorph.PointWithMeta} point
       * @param {NPC.NpcClassKey} [npcClassKey]
       */
      async function fadeSpawnDo(npcKey, point, npcClassKey) {
        const spawned = w.npcs.npc[npcKey];
        if (spawned?.doMeta) {
          npcClassKey && spawned.changeClass(npcClassKey);
          await spawned.fadeSpawn(point);
        } else {
          await w.npcs.spawn({ npcKey, point, npcClassKey });
          if (point.meta?.do) {
            await spawned.do(point, { fadeOutMs: 0 });
          }
        }
      }

      if (api.isTtyAt(0)) {
        const point = api.parseJsArg(pointStr);
        point.meta ??= {};
        await fadeSpawnDo(npcKey, point, npcClassKey);
      } else {
        while ((datum = await api.read()) !== null) {
          await fadeSpawnDo(datum.npcKey, datum.point, datum.classKey ?? npcClassKey);
        }
      }
    },
  
    /**
     * Track npc
     */
    track: async function* ({ api, args: [npcKey], home }) {
      const w = api.getCached(home.WORLD_KEY)
      w.npcs.connectSession(api.meta.sessionKey, { panzoomPid: api.meta.pid });
      api.addResume(() => {
        w.npcs.events.next({ key: "resumed-track", npcKey });
        return true;
      });
      
      try {
        await /** @type {Promise<void>} */ (new Promise(resolve => {
          const subscription = w.npcs.trackNpc({ npcKey, process: api.getProcess() })
          subscription.add(resolve); // resolve on unsubscribe or invoke cleanups
          api.addCleanup(() => subscription.unsubscribe());
          api.addCleanup(resolve);
        }))
      } finally {
        w.npcs.disconnectSession(api.meta.sessionKey, { panzoomPid: api.meta.pid });
      }
    },
  
    /**
     * - view {seconds} [{point}] [{zoom}]
     * - view `{ ms?: number; point?: Geom.VectJson, zoom?: number }`
     */
    view: async function* ({ api, args, home }) {
      const [p1, p2, p3] = args.map(api.parseJsArg)
      const w = api.getCached(home.WORLD_KEY)

      w.npcs.connectSession(api.meta.sessionKey, { panzoomPid: api.meta.pid })
      api.addSuspend(() => { w.panZoom.animationAction("pause"); return true; })
      api.addResume(() => { w.panZoom.animationAction("play"); return true; })
      api.addCleanup(() => w.panZoom.animationAction("cancel"))

      try {
        if (typeof p1 === "number") {
          await w.npcs.panZoomTo({ ms: p1 * 1000,
            ...typeof p2 === "number" ? { zoom: p2 } : { point: p2, zoom: p3 }
          })
        } else {
          await w.npcs.panZoomTo(p1)
        }
      } finally {
        w.npcs.disconnectSession(api.meta.sessionKey, { panzoomPid: api.meta.pid })
      }
    },
  
    /**
     * Move a specific npc along a @see {NPC.GlobalNavPath} <br/>
     * `npcKey` must be first operand
     * ```sh
     * click | nav rob | walk rob
     * nav rob $( click 1) | walk rob
     * nav rob $( click 1) > navPath; walk rob "$navPath"
     * ```
     */
    walk: async function* ({ api, args, home, datum }) {
      const { opts, operands: [npcKey, navPathStr] } = api.getOpts(args, { boolean: [
        "open",       /** Try to open closed doors */
        "safeOpen",   /** Try to open closed doors, except locked ones */
        "forceOpen",  /** Try and can open any doors (as if had skeleton key) */
        "forever",    /** Ignore errors when inside loop */
      ]});
      /** @type {NPC.WalkDoorStrategy} */
      const doorStrategy = opts.open && "open" ||
        opts.safeOpen && "safeOpen" ||
        opts.forceOpen && "forceOpen" || "none";

      const w = api.getCached(home.WORLD_KEY)
      const npc = w.npcs.handleLongRunningNpcProcess(api, npcKey);

      if (api.isTtyAt(0)) {
        await npc.walk(api.parseJsArg(navPathStr), { doorStrategy });
      } else {
        let reject = /** @param {*} _ */ (_) => {};
        let promise = Promise.resolve();
        const onError = /** @type {(e: *) => void} */ (opts.forever
          ? e => void (w.npcs.config.verbose && api.info(`ignored: ${e}`))
          : e => reject(e)
        );
        
        while ((datum = await Promise.race([
          api.read(),
          new Promise((_, r) => reject = r),
        ])) !== null) {
          promise = npc.walk(datum, { doorStrategy }).catch(onError)
        }
        await promise; // After EOF
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
  