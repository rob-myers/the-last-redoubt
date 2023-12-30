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
 * 🚧 can migrate using WORLD_KEY_ALT
 * @typedef RunArg
 * @property {import('./cmd.service').CmdService['processApi'] & {
 *   getCached(key: '__WORLD_KEY_VALUE__'): import('../world/World').State;
 *   getCached(key: '__WORLD_KEY_ALT_VALUE__'): import('../world-pixi/WorldPixi').State;
 * }} api
 * @property {string[]} args
 * @property {{ [key: string]: any; WORLD_KEY: '__WORLD_KEY_VALUE__'; WORLD_KEY_ALT: '__WORLD_KEY_ALT_VALUE__' }} home
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
      while ((datum = await api.read()) !== api.eof)
        if (func(datum, ctxt)) yield datum
    },

    /** Combines map (singleton), filter (empty array) and split (of arrays) */
    flatMap: async function* (ctxt) {
      let { api, args, datum } = ctxt, result
      const func = Function(`return ${args[0]}`)()
      while ((datum = await api.read(true)) !== api.eof) { 
        if (datum?.__chunk__) yield { ...datum, items: /** @type {any[]} */ (datum.items).flatMap(x => func(x, ctxt)) }
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
      while ((datum = await api.read(true)) !== api.eof) {
        if (datum?.__chunk__) yield { ...datum, items: /** @type {any[]} */ (datum.items).map(x => func(x, ctxt)) }
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
      while ((datum = await api.read()) !== api.eof)
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
      while ((datum = await api.read()) !== api.eof) {
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
      while ((datum = await api.read()) !== api.eof)
        outputs.push(datum)
      yield outputs
    },
  
    take: async function* ({ api, args, datum }) {
      let remainder = Number(args[0] || Number.POSITIVE_INFINITY)
      while ((remainder-- > 0) && ((datum = await api.read(true)) !== api.eof))
        if (datum?.__chunk__) {
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
        throw new Error("format: \`click [{numberOfClicks}]\`")
      }
      
      const w = api.getCached(home.WORLD_KEY)
      api.addCleanup(() => eventsSub?.unsubscribe())
      clickId && api.addCleanup(() => w.lib.removeFirst(w.panZoom.clickIds, clickId));

      while (numClicks-- > 0) {
        clickId && w.panZoom.clickIds.push(clickId);
        
        const e = await /** @type {Promise<PanZoom.PointerUpEvent>} */ (new Promise((resolve, reject) => {
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
          "name", /** Can name navPath */
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
        return w.lib.concatenateNavPaths(navPaths, opts.name);
      }
      
      if (api.isTtyAt(0)) {
        yield computeNavPath(parsedArgs);
      } else {
        while ((datum = await api.read()) !== api.eof) {
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

      if (!w.lib.isNpcActionKey(args[0])) {
        if (args[0] in w.npcs.npc) {
          args.unshift("get"); // npc {npcKey} [*] -> npc get {npcKey} [*]
        } else {
          throw new Error(`${args[0]}: invalid action`);
        }
      }

      const action = /** @type {NPC.NpcActionKey} */ (args[0]);
      if (action === "events") {
        return yield* w.lib.yieldEvents(w, api);
      }

      if (api.isTtyAt(0)) {
        const npcAct = w.lib.normalizeNpcCommandOpts(
          action,
          api.parseJsArg(args[1]),
          args.slice(2).map(arg => api.parseJsArg(arg)),
        );
        yield await w.npcs.npcAct(npcAct, api);
      } else {
        /** @param {*} e */
        const onError = e => void (w.npcs.config.verbose && api.info(`ignored: ${e?.message ?? e}`));

        if (action === "get" && (args[2] === "walk" || args[2] === "lookAt")) {
          // walk/look need to respond immediately
          const npc = w.npcs.getNpc(args[1], api);
          await api.eagerReadLoop(
            async (datum) => {
              const selector = api.generateSelector(args[2], api.addStdinToArgs(datum, args.slice(3).map(api.parseJsArg)));
              await selector.call(npc, npc);
            },
            () => npc.cancel(),
          );
        } else {// Standard case
          while ((datum = await api.read()) !== api.eof) {
            const npcAct = args.length === 1
              ? w.lib.normalizeNpcCommandOpts(action, datum, [])
              // 🤔 careful parseJsArg does not misinterpret strings
              : w.lib.normalizeNpcCommandOpts(action, args[1], api.addStdinToArgs(datum, args.slice(2).map(api.parseJsArg)))
            ;
            yield await w.npcs.npcAct(npcAct, api).catch(onError);
          }
        }
      }

    },
  
    controlNpc: async function* ({ api, args: [npcKey], home }) {
      const w = api.getCached(home.WORLD_KEY)
      const npc = w.npcs.connectNpcToProcess(api, npcKey);
      
      /** @param {*} e */
      const onError = e => void (w.npcs.config.verbose && api.info(`ignored: ${e?.message ?? e}`));
      let datum = /** @type {Geomorph.PointWithMeta} */ ({});

      while ((datum = await api.read()) !== api.eof) {
        const { meta } = (datum);
        if (meta.npc || npc.forcePaused) {
          if (meta.npcKey === npcKey && meta.longClick) {
            w.fov.mapAct("show-for", 3000);
          }
          continue;
        }

        if (meta.do || meta.door || (npc.doMeta && meta.nav)) {// do
          !meta.door && await npc.cancel();
          await npc.do(datum).catch(onError);
        } else if (meta.nav && !meta.ui) {
          const position = npc.getPosition();
          if (meta.longClick && !npc.isWalking() || !w.npcs.isPointInNavmesh(position)) {
            await npc.cancel();
            if (w.npcs.canSee(position, datum, npc.getInteractRadius())) {
              await npc.fadeSpawn(datum).catch(onError); // warp
            }
          } else {// walk
            if (npc.isWalking(true)) {// keep walking on long click or angle ≤ 90°
              const [u, v] = (npc.anim.path).concat(npc.nextWalk?.visits ?? []).slice(-2);
              const dp = (v.x - u.x) * (datum.x - v.x) + (v.y - u.y) * (datum.y - v.y);
              if (meta.longClick || dp >= 0) {
                npc.extendNextWalk(datum);
                continue;
              }
            }
            await npc.cancel();
            const navPath = w.npcs.getGlobalNavPath(position, datum, {
              closedWeight: 10000, // 🤔
              centroidsFallback: true,
            });
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
     * Handles "do points":
     * - spawn _from_ do
     * - spawn _to_ do
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
        if (w.npcs.npc[npcKey]?.doMeta) {// from `do` point
          const spawned = w.npcs.connectNpcToProcess(api, npcKey);
          npcClassKey && spawned.changeClass(npcClassKey);
          await spawned.fadeSpawn(point);
        } else {
          await w.npcs.spawn({ npcKey, point, npcClassKey });
          if (point.meta?.do) {// to `do` point
            const spawned = w.npcs.connectNpcToProcess(api, npcKey);
            await spawned.do(point, { fadeOutMs: 0 });
          }
        }
      }

      if (api.isTtyAt(0)) {
        const point = api.parseJsArg(pointStr);
        point.meta ??= {};
        await fadeSpawnDo(npcKey, point, npcClassKey);
      } else {
        while ((datum = await api.read()) !== api.eof) {
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
          const subscription = w.npcs.trackNpc(npcKey, api);
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
      // const w = api.getCached(home.WORLD_KEY_ALT)

      w.npcs.connectSession(api.meta.sessionKey, { panzoomPid: api.meta.pid })
      api.addSuspend(() => { w.panZoom.animationAction("pause"); return true; })
      api.addResume(() => { w.panZoom.animationAction("play"); return true; })
      api.addCleanup(() => w.panZoom.animationAction("cancelPanZoom"))

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
     * Move specific npc along a @see {NPC.GlobalNavPath} <br/>
     * `npcKey` must be first operand
     * ```sh
     * click | nav rob | walk --open rob
     * click | nav rob | walk --forever rob
     * nav rob $( click 1) | walk rob
     * nav rob $( click 1) > navPath; walk rob "$navPath"
     * ```
     */
    walk: async function* ({ api, args, home }) {
      const { opts, operands: [npcKey, datumStr] } = api.getOpts(args, { boolean: [
        "open",       /** Try to open closed doors */
        "safeOpen",   /** Try to open closed doors, except locked ones */
        "forceOpen",  /** Try/can open any doors (as if had skeleton key) */
        "forever",    /** Ignore errors inside loop */
      ]});
      /** @type {NPC.WalkDoorStrategy} */
      const doorStrategy = opts.open && "open" ||
        opts.safeOpen && "safeOpen" ||
        opts.forceOpen && "forceOpen" || "none"
      ;

      const w = api.getCached(home.WORLD_KEY)
      const npc = w.npcs.connectNpcToProcess(api, npcKey);

      if (api.isTtyAt(0)) {
        const datum = api.parseJsArg(datumStr);
        return await npc.walk(
          w.lib.isVectJson(datum)
            ? w.npcs.getGlobalNavPath(npc.getPosition(), datum, { ...npc.navOpts, endsNavigable: true })
            : datum,
          { doorStrategy },
        );
      }

      await api.eagerReadLoop(/** @param {NPC.GlobalNavPath | Geomorph.PointMaybeMeta} datum */
        async (datum) => {
          try {
            if (w.lib.isVectJson(datum)) {
              if (datum.meta?.npc && datum.meta.npcKey === npc.key) {
                return; // Ignore self clicks e.g. on unpause
              }
              if (npc.isWalking(true) && !datum.meta?.longClick) {
                npc.extendNextWalk(datum);
              } else {
                await npc.cancel();
                await npc.walk(w.npcs.getGlobalNavPath(npc.getPosition(), datum, npc.navOpts), { doorStrategy });
              }
            } else {
              await npc.walk(datum, { doorStrategy });
            }
          } catch (e) {
            if (opts.forever) {
              w.npcs.config.verbose && api.info(`ignored: ${/** @type {*} */ (e)?.message ?? e}`);
            } else {
              throw e;
            }
          }
        },
        (datum) => !w.lib.isVectJson(datum) && npc.cancel(), // 🤔 could be empty
      );
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
  