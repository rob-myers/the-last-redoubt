import cliColumns from 'cli-columns';
import { uid } from 'uid';

import { Deferred, deepGet, keysDeep, pause, pretty, removeFirst, safeStringify, testNever, truncateOneLine } from '../service/generic';
import { ansi, computeNormalizedParts, handleProcessError, killError, killProcess, normalizeAbsParts, parseTtyMarkdownLinks, ProcessError, resolveNormalized, resolvePath, ShError } from './util';
import type * as Sh from './parse';
import { getProcessStatusIcon, ReadResult, preProcessRead, dataChunk, isProxy } from './io';
import useSession, { ProcessStatus } from './session.store';
import { cloneParsed, getOpts, parseService } from './parse';
import { ttyShellClass } from './tty.shell';

import { scriptLookup } from './scripts';
import { getCached } from '../service/query-client';
import { observableToAsyncIterable } from '../service/observable-to-async-iterable';

/** Shell builtins */
const commandKeys = {
  /** Change current key prefix */
  cd: true,
  /** Write tty message with markdown links and associated actions */
  choice: true,
  /** List function definitions */
  declare: true,
  /** Output arguments as space-separated string */
  echo: true,
  /** Exit with code 1 */
  false: true,
  /** Get each arg from __TODO__ */
  get: true,
  /** List commands */
  help: true,
  /** List previous commands */
  history: true,
  /** Kill a process */
  kill: true,
  /** Local variables */
  local: true,
  /** List variables */
  ls: true,
  /** List running processes */
  ps: true,
  /** Print current key prefix */
  pwd: true,
  /** Exit from a function */
  return: true,
  /** Remove variable(s) */
  rm: true,
  /** Run a javascript generator */
  run: true,
  /** Echo session key */
  session: true,
  /** Set something */
  set: true,
  /** Wait for specified number of seconds */
  sleep: true,
  /** Run shell code stored as a string somewhere */
  source: true,
  /** Evaluate javascript expression and exit code 1 <=> truthy */
  test: true,
  /** Exit with code 0 */
  true: true,
  /** Unset top-level variables and shell functions */
  unset: true,
};

type CommandName = keyof typeof commandKeys;

class cmdServiceClass {

  isCmd(word: string): word is CommandName {
    return word in commandKeys;
  }
  
  async *runCmd(node: Sh.CallExpr | Sh.DeclClause, command: CommandName, args: string[]) {
    const { meta } = node;
    switch (command) {
      case 'cd': {
        if (args.length > 1) {
          throw new ShError('usage: `cd /`, `cd`, `cd foo/bar`, `cd /foo/bar`, `cd ..` and `cd -`', 1);
        }
        const prevPwd: string = useSession.api.getVar(meta, 'OLDPWD');
        const currPwd: string = useSession.api.getVar(meta, 'PWD');
        useSession.api.setVar(meta, 'OLDPWD', currPwd);

        try {
          if (!args[0]) {
            useSession.api.setVar(meta, 'PWD', 'home');
          } else if (args[0] === '-') {
            useSession.api.setVar(meta, 'PWD', prevPwd);
          } else if (args[0].startsWith('/')) {
            const parts = normalizeAbsParts(args[0].split('/'));
            if (resolveNormalized(parts, this.provideProcessCtxt(node.meta)) === undefined) {
              throw Error;
            }
            useSession.api.setVar(meta, 'PWD', parts.join('/'));
          } else {
            const parts = normalizeAbsParts(currPwd.split('/').concat(args[0].split('/')));
            if (resolveNormalized(parts, this.provideProcessCtxt(node.meta)) === undefined) {
              throw Error;
            }
            useSession.api.setVar(meta, 'PWD', parts.join(('/')));
          }
        } catch {
          useSession.api.setVar(meta, 'OLDPWD', prevPwd);
          throw new ShError(`${args[0]} not found`, 1);
        }
        break;
      }
      case 'choice': {
        if (isTtyAt(meta, 0)) {
          // `choice {textWithLinks}+ [secondsToWait] [defaultValue]`
          const secsIndex = args.findIndex(x => Number.isFinite(parseInt(x)));
          const text = args.slice(0, secsIndex >= 0 ? secsIndex : undefined).join(' ');
          const secs = secsIndex >= 0 ? parseInt(args[secsIndex]) : undefined;
          const defaultValue = secsIndex >= 0 ? parseJsArg(args[secsIndex + 1]) : undefined;
  
          yield* this.choice(meta, { text, defaultValue, secs });
        } else {
          // `choice` expects to read `ChoiceReadValue`s
          let datum: ChoiceReadValue;
          while ((datum = await read(meta)) !== null)
            yield* this.choice(meta, datum);
        }
        break;
      }
      case 'declare': {
        const { opts, operands } = getOpts(args, { boolean: [
          'f', // list functions [matching prefixes]
          'F', // list function names [matching prefixes]
          'x', // list variables [matching prefixes]
          'p', // list variables [matching prefixes]
        ], });

        const noOpts = [opts.x, opts.p, opts.f, opts.F].every(opt => opt !== true);
        const showVars = opts.x === true || opts.p === true || noOpts;
        const showFuncs = opts.f === true || noOpts;
        const showFuncNames = opts.F === true;
        // Only match prefixes when some option specified
        const prefixes = operands.length && !noOpts ? operands : null;

        const {
          var: home,
          func,
          ttyShell: { xterm },
          process: { [meta.pid]: { inheritVar } }
        } = useSession.api.getSession(meta.sessionKey);

        const vars = { ...home, ...inheritVar };
        const funcs = Object.values(func);

        if (showVars) {
          for (const [key, value] of Object.entries(vars)) {
            if (prefixes && !prefixes.some(x => key.startsWith(x))) continue;
            yield `${ansi.Blue}${key}${ansi.Reset}=${
              typeof value === 'string' ? ansi.White : ansi.Yellow
            }${safeStringify(value).slice(-xterm.maxStringifyLength)}${ansi.Reset}`;
          }
        }
        if (showFuncs) {
          // If 1 prefix and exact match, we'll only show exact match,
          // so that `declare -f foo` works as expected
          const exactMatch = prefixes?.length == 1 ? prefixes.find(prefix => func[prefix]) : undefined;
          for (const { key, src } of funcs) {
            if (prefixes && !prefixes.some(x => key.startsWith(x))) continue;
            if (exactMatch && key !== exactMatch) continue;
            const lines = `${ansi.Blue}${key}${ansi.White} () ${src}${ansi.Reset}`.split(/\r?\n/);
            for (const line of lines) yield line;
            yield '';
          }
        }
        if (showFuncNames) {
          for (const { key } of funcs) {
            if (prefixes && !prefixes.some(x => key.startsWith(x))) continue;
            yield `${ansi.White}declare -f ${key}${ansi.Reset}`;
          }
        }
        break;
      }
      case 'echo': {
        const { opts, operands } = getOpts(args, { boolean: [
          'a', // output array
          'n', // cast as numbers
        ], });
        if (opts.a) {
          yield opts.n ? operands.map(Number) : operands;
        } else if (opts.n) {
          for (const operand of operands) yield Number(operand);
        } else {
          yield operands.join(' ');
        }
        break;
      }
      case 'false': {
        node.exitCode = 1;
        break;
      }
      case 'get': {
        yield* this.get(node, args);
        break;
      }
      case 'help': {
        const { ttyShell } = useSession.api.getSession(meta.sessionKey);
        yield `The following commands are supported:`;
        const commands = cliColumns(Object.keys(commandKeys), { width: ttyShell.xterm.xterm.cols }).split(/\r?\n/);
        for (const line of commands) yield `${ansi.Blue}${line}`;
        // yield `Traverse context via \`ls\` or \`ls -l var.foo.bar\` (Object.keys).` 
        yield `\n\rView shell functions via ${ansi.Blue}declare${ansi.Reset}.`
        // yield `Use Ctrl-c to interrupt and Ctrl-l to clear screen.`
        // yield `View history via up/down or \`history\`.`
        // yield `Traverse input using Option-left/right and Ctrl-{a,e}.`
        // yield `Delete input using Ctrl-{w,u,k}.`
        // yield `You can copy and paste.`
        // yield `Features: functions, pipes, command substitution, background processes, history, readline-esque shortcuts, copy-paste.`
        break;
      }
      case 'history': {
        const { ttyShell } = useSession.api.getSession(meta.sessionKey);
        const history = ttyShell.getHistory();
        for (const line of history) yield line;
        break;
      }
      case 'kill': {
        const { opts, operands } = getOpts(args, { boolean: [
          'STOP', /** --STOP pauses a process */
          'CONT', /** --CONT continues a paused process */
        ] });

        const pids = operands.map(x => parseJsonArg(x))
          .filter((x): x is number => Number.isFinite(x));

        for (const pid of pids) {
          const { process: { [pid]: process } } = useSession.api.getSession(meta.sessionKey);
          const processes = process.pgid === pid
            // Apply command to whole process group
            ? useSession.api.getProcesses(meta.sessionKey, process.pgid).reverse()
            // Apply command to exactly one process
            : [process];

          // NOTE on{Suspend,Resume}s are "first-in first-invoked"
          processes.forEach(p => {
            if (opts.STOP) {
              p.onSuspends = p.onSuspends.filter(onSuspend => onSuspend());
              p.status = ProcessStatus.Suspended;
            } else if (opts.CONT) {
              p.onResumes = p.onResumes.filter(onResume => onResume());
              p.status = ProcessStatus.Running;
            } else {
              p.status = ProcessStatus.Killed;
              // Avoid immediate clean because it stops `sleep` (??)
              window.setTimeout(() => killProcess(p));
            }
          });
        }
        break;
      }
      case 'local': {
        const process = useSession.api.getProcess(node.meta);
        if (process.key === 0) {
          throw new ShError('session leader doesn\'t support local variables', 1);
        }
        if (args.join(' ').includes('=')) {
          throw new ShError('usage: `local x y z` (assign values elsewhere)', 1);
        }
        for (const name of args) {
          if (name) {
            process.localVar[name] = undefined;
          }
        }
        break;
      }
      case 'ls': {
        const { opts, operands } = getOpts(args, { boolean: [
          '1', /** One line per item */
          'l', /** Detailed */
          'r', /** Recursive properties (prototype) */
          'a', /** Show capitalized vars at top level */
        ] });
        const pwd = useSession.api.getVar(meta, 'PWD');
        const queries = operands.length ? operands.slice() : [''];
        const root = this.provideProcessCtxt(meta);
        const roots = queries.map(path => resolvePath(path, root, pwd));

        const { ttyShell } = useSession.api.getSession(node.meta.sessionKey);
        for (const [i, obj] of roots.entries()) {
          if (obj === undefined) {
            useSession.api.writeMsg(meta.sessionKey, `ls: "${queries[i]}" is not defined`, 'error');
            continue;
          }

          if (roots.length > 1) yield `${ansi.Blue}${queries[i]}:`;
          let keys = (opts.r ? keysDeep(obj) : Object.keys(obj)).sort();
          let items = [] as string[];
          if (pwd === 'home' && !opts.a) keys = keys.filter(x => x.toUpperCase() !== x || /^[0-9]/.test(x));

          if (opts.l) {
            if (typeof obj === 'function') keys = keys.filter(x => !['caller', 'callee', 'arguments'].includes(x));
            const metas = opts.r
              ? keys.map(x => deepGet(obj, x.split('/'))?.constructor?.name || (obj[x] === null ? 'null' : 'undefined'))
              : keys.map(x => obj[x]?.constructor?.name || (obj[x] === null ? 'null' : 'undefined'));
            const metasWidth = Math.max(...metas.map(x => x.length));
            items = keys.map((x, i) => `${ansi.Yellow}${metas[i].padEnd(metasWidth)}${ansi.White} ${x}${ansi.Reset}`);
          } else if (opts[1]) {
            items = keys;
          } else {
            items = cliColumns(keys, { width: ttyShell.xterm.xterm.cols }).split(/\r?\n/);
          }
          for (const item of items) yield item;
        }
        break;
      }
      case 'ps': {
        const { opts } = getOpts(args, { boolean: [
          'a', /** Show all processes */
          's', /** Show process src */
        ], });
        const processes = Object.values(useSession.api.getProcesses(meta.sessionKey))
          .filter(({ key: pid, pgid }) => opts.a ? true : pid === pgid);
        const title = ['pid', 'ppid', 'pgid'].map(x => x.padEnd(5)).join(' ')

        if (opts.s) {
          for (const { key: pid, ppid, pgid, status, src } of processes) {
            const icon = getProcessStatusIcon(status);
            const info = [pid, ppid, pgid].map(String).map(x => x.padEnd(5)).join(' ')
            yield `${ansi.Blue}${title}${ansi.Reset}`;
            yield `${info}${icon}`;
            yield src + '\n';
          }
        } else {
          yield `${ansi.Blue}${title}${ansi.Reset}`;
          for (const { key: pid, ppid, pgid, status, src } of processes) {
            const icon = getProcessStatusIcon(status);
            const info = [pid, ppid, pgid].map(String).map(x => x.padEnd(5)).join(' ');
            const shortSrc = truncateOneLine(src.trimLeft(), 30);
            yield `${info}${icon}  ${shortSrc}`;
          }
        }
        break;
      }
      case 'pwd': {
        yield '/' + (useSession.api.getVar(meta, 'PWD'));
        break;
      }
      case 'return': {
        // We simply kill the current process.
        // 🚧 worth doing something more complex now we use WhileClause?
        const exitCode = parseInt(args[0]);
        throw killError(
          meta,
          Number.isInteger(exitCode)
            ? exitCode
            : useSession.api.getSession(meta.sessionKey).lastExitCode,
          0, // Only terminate current process (a shell function)
        );
      }
      case 'rm': {
        const root = this.provideProcessCtxt(meta);
        const pwd = useSession.api.getVar<string>(meta, 'PWD');
        for (const path of args) {
          const parts = computeNormalizedParts(path, pwd);
          if (parts[0] === 'home' && parts.length > 1) {
            const last = parts.pop() as string;
            delete resolveNormalized(parts, root)[last];
          } else {
            throw new ShError(`cannot delete ${path}`, 1);
          }
        }
        break;
      }
      /** e.g. run '({ api:{read} }) { yield "foo"; yield await read(); }' */
      case 'run': {
        try {
          const func = Function('_', `return async function *generator ${args[0]}`);
          yield* func()(this.provideProcessCtxt(meta, args.slice(1)));
        } catch (e) {
          if (e instanceof ProcessError) {
            handleProcessError(node, e);
          } else if (e instanceof ShError) {
            node.exitCode = e.exitCode;
            throw e;
          } else {
            console.error(e); // Provide JS stack
            node.exitCode = 1;
            throw new ShError(`${e}`, 1);
          }
        }
        break;
      }
      case 'session': {
        yield meta.sessionKey;
        break;
      }
      case 'set': {
        const root = this.provideProcessCtxt(meta);
        const value = parseJsArg(args[1]);
        if (args[0][0] === '/') {
          Function('__1', '__2', `return __1.${args[0].slice(1)} = __2`)(root, value);
        } else {
          const cwd = this.computeCwd(meta, root);
          Function('__1', '__2', `return __1.${args[0]} = __2`)(cwd, value);
        }
        break;
      }
      case 'sleep': {
        const seconds = args.length ? parseFloat(parseJsonArg(args[0])) || 0 : 1;
        yield* sleep(meta, seconds);
        break;
      }
      case 'source': {
        const script = this.get(node, [args[0]])[0];
        if (script === undefined) {
          useSession.api.writeMsg(meta.sessionKey, `source: "${args[0]}" not found`, 'error');
        } else if (typeof script !== 'string') {
          useSession.api.writeMsg(meta.sessionKey, `source: "${args[0]}" is not a string`, 'error');
        } else {
          // We cache scripts
          const parsed = parseService.parse(script, true);
          // We mutate `meta` because it may occur many times deeply in tree
          // Also, pid will be overwritten in `ttyShell.spawn`
          Object.assign(parsed.meta, { ...meta, fd: { ...meta.fd }, stack: meta.stack.slice() });
          const { ttyShell } = useSession.api.getSession(meta.sessionKey);
          // We spawn a new process (unlike bash `source`), but we don't localize PWD
          await ttyShell.spawn(parsed, { posPositionals: args.slice(1) });
        }
        break;
      }
      case 'test': {    
        node.exitCode = !!parseJsArg(args.join(" ")) ? 1 : 0;
        break;
      }
      case 'true': {
        node.exitCode = 0;
        break;
      }
      case 'unset': {
        const {
          var: home,
          func,
          process: { [meta.pid]: process },
        } = useSession.api.getSession(meta.sessionKey);

        for (const arg of args) {
          if (arg in process.localVar) {
            // NOTE cannot unset ancestral variables
            delete process.localVar[arg];
          } else {
            delete home[arg];
            delete func[arg];
          }
        }
        break;
      }
      default:
        throw testNever(command, { suffix: 'runCmd' });
    }
  }

  /**
   * `defaultValue` emitted:
   * - on timeout without link selected
   * - on link selected with value undefined e.g. [foo](-) or [foo](undefined)
   */
  private async *choice(
    meta: Sh.BaseMeta,
    { text, defaultValue, secs }: ChoiceReadValue,
  ) {
    const lines = text.replace(/\r/g, '').split(/\n/);
    const parsedLines = lines.map(text => parseTtyMarkdownLinks(text, defaultValue));
    for (const {ttyText} of parsedLines) {
      await useSession.api.writeMsgCleanly(meta.sessionKey, ttyText);
    }

    try {
      /** Avoid many cleanups if pause/resume many times: @see {sleep} */
      let reject = (_?: any) => {};
      const cleanup = () => reject();
      getProcess(meta).cleanups.push(cleanup);
      // ℹ️ pause/resume handling not needed: cannot click links when paused

      const linkPromFactory = parsedLines.some(x => x.linkCtxtsFactory)
        ? () => new Promise<any>((resolve, currReject) => {
            reject = currReject;
            parsedLines.forEach(({ ttyTextKey, linkCtxtsFactory }) =>
              linkCtxtsFactory && useSession.api.addTtyLineCtxts(meta.sessionKey, ttyTextKey, linkCtxtsFactory(resolve))
            );
          })
        : undefined;

      if (typeof secs === 'number' || !linkPromFactory) {
        // links have timeout (also if no links, with fallback 0)
        // yield* sleep(meta, secs, linkPromFactory);
        let lastValue: any = undefined;
        for await (const value of sleep(meta, secs ?? 0, linkPromFactory))
          yield lastValue = value;
        if (lastValue === undefined)
          yield defaultValue;
      } else {// some link must be clicked to proceed
        yield await linkPromFactory();
      }
    } finally {
      // ℹ️ currently assume one time usage
      parsedLines.forEach(({ ttyTextKey }) => useSession.api.removeTtyLineCtxts(meta.sessionKey, ttyTextKey));
    }
  }

  get(node: Sh.BaseNode, args: string[]) {
    const root = this.provideProcessCtxt(node.meta);
    const pwd = useSession.api.getVar<string>(node.meta, 'PWD');
    const process = useSession.api.getProcess(node.meta);

    const outputs = args.map(arg => {
      const parts = arg.split('/');
      const localCtxt = parts[0] in process.localVar
        ? process.localVar
        : parts[0] in process.inheritVar ? process.inheritVar : null
      ;

      return parts[0] && localCtxt
        ? parts.reduce((agg, part) => agg[part], localCtxt)
        : resolvePath(arg, root, pwd);
    });

    node.exitCode = outputs.length && outputs.every(x => x === undefined) ? 1 : 0;
    return outputs;
  }

  private computeCwd(meta: Sh.BaseMeta, root: any) {
    const pwd = useSession.api.getVar(meta, 'PWD');
    return resolveNormalized(pwd.split('/'), root);
  }

  async launchFunc(node: Sh.CallExpr, namedFunc: Sh.NamedFunction, args: string[]) {
    const cloned = cloneParsed(namedFunc.node);
    const { ttyShell } = useSession.api.getSession(node.meta.sessionKey);
    Object.assign(cloned.meta, {
      ...node.meta,
      ppid: node.meta.pid,
      stack: node.meta.stack.concat(namedFunc.key), // TODO elsewhere?
    } as Sh.BaseMeta);
    try {
      // Run function in own process, yet without localized PWD
      await ttyShell.spawn(cloned, { posPositionals: args.slice() });
    } finally {
      // Propagate function exitCode to callee
      // ℹ️ Errors are usually caught earlier via `handleShError`,
      //    but may arise via `kill` or failed pipe-sibling
      node.exitCode = cloned.exitCode;
    }
  }

  /**
   * NOTE `this` must only refer to `meta` and `parent`.
   */
  private readonly processApi = {
    /**
     * This will be overwritten via Function.prototype.bind.
     */
    meta: {} as Sh.BaseMeta,
    /**
     * This will be rewritten via Function.prototype.bind.
     */
    parent: this,

    /** Returns provided cleanup */
    addCleanup(cleanup: () => void) {
      getProcess(this.meta).cleanups.push(cleanup);
      return cleanup;
    },
    /**
     * Executed on suspend, without clearing `true` returners. The latter should be idempotent, e.g. unsubscribe, pause.
     */
    addResume(cleanup: () => void) {
      getProcess(this.meta).onResumes.push(cleanup);
    },
    /**
     * Executed on suspend, without clearing `true` returners. The latter should be idempotent, e.g. unsubscribe, pause.
     */
    addSuspend(cleanup: () => void) {
      getProcess(this.meta).onSuspends.push(cleanup);
    },

    getCached,

    getColors() {
      return ansi;
    },
  
    getKillError() {
      return killError(this.meta);
    },
  
    getOpts,

    getProcess() {
      return getProcess(this.meta);
    },
  
    /** Returns a string e.g. `60f5bfdb9b9` */
    getUid() {
      return uid();
    },

    info(message: string) {
      useSession.api.writeMsg(this.meta.sessionKey, message, 'info');
    },

    isTtyAt(fd = 0) {
      return isTtyAt(this.meta, fd);
    },

    observableToAsyncIterable,
  
    /** js parse with string fallback */
    parseJsArg,
    /** @see {parseJsArg} acted upon by callback */
    parseMapJsArg,
  
    // TODO use `otag` instead
    /** Output 1, 2, ... at fixed intervals */
    async *poll(args: string[]) {
      const seconds = args.length ? parseFloat(parseJsonArg(args[0])) || 1 : 1;
      const [delayMs, deferred] = [Math.max(seconds, 0.5) * 1000, new Deferred<void>()];
      getProcess(this.meta).cleanups.push(() => deferred.reject(killError(this.meta)));
      let count = 1;
      while (true) {
        yield count++;
        await Promise.race([pause(delayMs), deferred.promise]);
      }
    },
  
    pretty(x: any) {
      return prettySafe(isProxy(x) ? {...x} : x);
    },

    /**
     * Read once from stdin. We convert `{ eof: true }` to `null` for
     * easier assignment, but beware of other falsies.
     */
    read(chunks?: boolean) {
      return read(this.meta, chunks);
    },

    removeCleanup(cleanup: () => void) {
      const { cleanups } = getProcess(this.meta);
      const index = cleanups.findIndex(x => x === cleanup);
      index >= 0 && cleanups.splice(index, 1);
    },

  
    async *sleep(seconds: number) {
      yield* sleep(this.meta, seconds);
    },
  
    /** JSON.parse which returns `undefined` on parse error */
    safeJsonParse,

    throwError,

  };
  
  private readonly processApiKeys = Object.keys(this.processApi);

  private provideProcessCtxt(meta: Sh.BaseMeta, posPositionals: string[] = []) {
    const session = useSession.api.getSession(meta.sessionKey);
    return new Proxy({
      home: session.var,
      // cache: queryCache,
      // dev: useSession.getState().device,
      etc: scriptLookup,
    }, {
      get: (_, key) => {
        if (key === 'api') {
          return new Proxy({}, {
            get: ({}, key: keyof typeof this.processApi) => {
              if (key === 'meta') return meta;
              if (key === 'parent') return null;
              return this.processApi[key]?.bind({ meta, parent: this }) || null;
            },
            // 🚧 ownKeys (requires getOwnPropertyDescriptor)
            getOwnPropertyDescriptor() {
              return { enumerable: true, configurable: true };
            },
            ownKeys: (target) => {
              return this.processApiKeys;
            }
          });
        } else if (key === 'args') {
          return posPositionals;
        } else if (key === '_') {// Can _ from anywhere e.g. inside root
          const lastValue = session.var._;
          return isProxy(lastValue) ? dataChunk([lastValue]) : lastValue;
        }
        return (_ as any)[key];
      },
      set: (_, key, value) => {
        if (key === 'args') {// Assume `posPositionals` is fresh i.e. just sliced
          posPositionals.length = 0;
          posPositionals.push(...value);
          return true;
        }
        return false;
      },
      deleteProperty(_target, _key) {
        return false;
      },
      // getOwnPropertyDescriptor(target, prop) {
      //   return { enumerable: true, configurable: true };
      // },
      ownKeys(target) {
        // return Reflect.ownKeys(target).concat('api', 'args', 'site');
        return Reflect.ownKeys(target);
      },
    });
  }

  private async *readLoop(
    meta: Sh.BaseMeta,
    /** Read exactly one item of data? */
    once = false,
    chunks: boolean,
  ) {
    const process = useSession.api.getProcess(meta);
    const device = useSession.api.resolve(0, meta);

    if (device === undefined) {
      return;
    } else if (device instanceof ttyShellClass && process.pgid !== 0) {
      throw new ShError('background process tried to read tty', 1);
    }

    let result = {} as ReadResult;
    while (!(result = await device.readData(once, chunks)).eof) {
      if (result.data !== undefined) {
        yield result;
        if (once) break;
      }
      await preProcessRead(process, device);
    }
  }

  /**
   * Reading once often means two outputs i.e. `{ data }` then `{ eof: true }`.
   * If there is any real data we return `{ data }`,
   * otherwise we (possibly eventually) return `{ eof: true }`.
   */
  async readOnce(meta: Sh.BaseMeta, chunks: boolean): Promise<ReadResult> {
    for await (const data of this.readLoop(meta, true, chunks)) {
      return data;
    }
    return { eof: true };
  }
  
}

//#region processApi related

function getProcess(meta: Sh.BaseMeta) {
  return useSession.api.getProcess(meta);
}

function isTtyAt(meta: Sh.BaseMeta, fd: number) {
  return meta.fd[fd]?.startsWith('/dev/tty-');
}

/**
 * js parse with string fallback, preserving `undefined`
 */
export function parseJsArg(input?: string) {
  try {
    return Function(`return ${input}`)();
  } catch (e) {
    return input;
  }
}

/**
 * js parse with string fallback, applying `act` afterwards.
 */
export function parseMapJsArg<T>(input: string | undefined, act: (parsed: any) => T) {
  try {
    return act(Function(`return ${input}`)());
  } catch (e) {
    return act(input);
  }
}

/** JSON.parse with string fallback */
function parseJsonArg(input: string) {
  try {
    return input === undefined ? undefined : JSON.parse(input);
  } catch {
    return input;
  }
}

function prettySafe(x: any) {
  return pretty(JSON.parse(safeStringify(x)));
}

/**
 * Read once from stdin. We convert `{ eof: true }` to `null` for
 * easier assignment, but beware of other falsies.
 */
async function read(meta: Sh.BaseMeta, chunks = false) {
  const result = await cmdService.readOnce(meta, chunks);
  return result?.eof ? null : result.data;
}

function safeJsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch  {
    return;
  }
}

export async function *sleep(
  meta: Sh.BaseMeta,
  seconds: number,
  interruptFactory?: () => Promise<any>,
) {
  const process = getProcess(meta);
  let duration = 1000 * seconds, startedAt = -1, reject = (_: any) => {};
  const cleanup = () => reject(killError(meta));
  process.cleanups.push(cleanup);
  do {
    let resolvedSleep = false;
    const value = await Promise.race([
      new Promise<void>((resolve, currReject) => {
        const resolveSleep = () => { resolvedSleep = true; resolve() };
        process.onSuspends.push(() => { duration -= (Date.now() - startedAt); resolveSleep(); });
        process.onResumes.push(() => { startedAt = Date.now() });
        reject = currReject; // We update cleanup here
        (startedAt = Date.now()) && setTimeout(resolveSleep, duration);
      }),
      ...interruptFactory ? [interruptFactory()] : []
    ]);
    if (!resolvedSleep) {// Interrupted
      yield value;
      break;
    }
    yield; // This yield pauses execution if process suspended
  } while (Date.now() - startedAt < duration - 1)
  // If process continually re-sleeps, avoid many cleanups
  removeFirst(process.cleanups, cleanup);
}

/**
 * Can prefix with `throw` for static analysis.
 * The outer throw will never be thrown.
 */
function throwError(message: string, exitCode = 1) {
  throw new ShError(message, exitCode);
}

//#endregion

interface ChoiceReadValue {
  text: string;
  defaultValue?: any;
  secs?: number;
}

export const cmdService = new cmdServiceClass;

export type CmdService = typeof cmdService;
