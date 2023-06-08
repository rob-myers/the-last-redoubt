import create from 'zustand';
import { devtools } from 'zustand/middleware';

import { addToLookup, deepClone, mapValues, removeFromLookup, tryLocalStorageGet, tryLocalStorageSet, KeyedLookup } from '../service/generic';
import { ansi, computeNormalizedParts, killProcess, resolveNormalized, ShError, stripAnsi } from './util';
import type { BaseMeta, FileWithMeta, NamedFunction } from './parse';
import type { MessageFromShell, MessageFromXterm } from './io';
import { Device, makeShellIo, ShellIo, FifoDevice, VarDevice, VarDeviceMode, NullDevice } from './io';
import { srcService } from './parse';
import { ttyShellClass } from './tty.shell';
import { scriptLookup } from './scripts';

export type State = {
  session: KeyedLookup<Session>;
  device: KeyedLookup<Device>;
  
  readonly api: {
    addFunc: (sessionKey: string, funcName: string, wrappedFile: FileWithMeta) => void;
    addTtyLineCtxts: (sessionKey: string, lineText: string, ctxts: TtyLinkCtxt[]) => void;
    cleanTtyLink: (sessionKey: string) => void;
    createSession: (sessionKey: string, env: Record<string, any>) => Session;
    createProcess: (def: {
      sessionKey: string;
      ppid: number;
      pgid: number;
      src: string;
      posPositionals?: string[];
    }) => ProcessMeta;
    createFifo: (fifoKey: string, size?: number) => FifoDevice;
    createVarDevice: (meta: BaseMeta, varPath: string, mode: VarDeviceMode) => VarDevice;
    getFunc: (sessionKey: string, funcName: string) => NamedFunction | undefined;
    getFuncs: (sessionKey: string) => NamedFunction[];
    getNextPid: (sessionKey: string) => number;
    getProcess: (meta: BaseMeta) => ProcessMeta;
    getProcesses: (sessionKey: string, pgid?: number) => ProcessMeta[];
    getPositional: (pid: number, sessionKey: string, varName: number) => string;
    getVar: <T = any>(meta: BaseMeta, varName: string) => T;
    getVarDeep: (meta: BaseMeta, varPath: string) => any | undefined;
    getSession: (sessionKey: string) => Session;
    onTtyLink: (sessionKey: string, lineText: string, linkText: string, linkStartIndex: number) => void;
    persist: (sessionKey: string) => void;
    rehydrate: (sessionKey: string) => Rehydrated;
    removeDevice: (deviceKey: string) => void;
    removeProcess: (pid: number, sessionKey: string) => void;
    removeSession: (sessionKey: string) => void;
    removeTtyLineCtxts: (sessionKey: string, line: string) => void;
    resolve: (fd: number, meta: BaseMeta) => Device;
    setVar: (meta: BaseMeta, varName: string, varValue: any) => void;
    setVarDeep: (meta: BaseMeta, varPath: string, varValue: any) => void;
    writeMsg: (sessionKey: string, msg: string, level: 'info' | 'error') => void;
    /**
     * Returns global line number of written message,
     * i.e. the 1-based index over all lines ever output in session's tty.
     */
    writeMsgCleanly: (sessionKey: string, msg: string, opts?: { prompt?: boolean; ttyLinkCtxts?: TtyLinkCtxt[] }) => Promise<void>;
  }
}

export interface Session {
  key: string;
  process: KeyedLookup<ProcessMeta>;
  func: KeyedLookup<NamedFunction>;

  /**
   * Currently only support one tty per session,
   * i.e. cannot have two terminals in same session.
   * This could be changed e.g. `ttys: { io, shell }[]`.
   */
  ttyIo: ShellIo<MessageFromXterm, MessageFromShell>;
  ttyShell: ttyShellClass,
  ttyLink: { [lineText: string]: TtyLinkCtxt[] };

  var: Record<string, any>;
  nextPid: number;
  lastExitCode: number;
}

interface Rehydrated {
  history: string[] | null;
  var: Record<string, any> | null;
}

export enum ProcessStatus {
  Suspended,
  Running,
  Killed,
}

export interface ProcessMeta {
  /** pid */
  key: number;
  ppid: number;
  pgid: number;
  sessionKey: string;
  /** `0` is suspended, `1` is running, `2` is killed */
  status: ProcessStatus;
  src: string;
  /**
   * Executed on Ctrl-C or `kill`.
   * May contain `() => reject(killError(meta))` ...
   */
  cleanups: ((() => void) & {  })[];
  /**
   * Executed on suspend, without clearing `true` returners.
   * The latter should be idempotent, e.g. unsubscribe, pause.
   */
  onSuspends: (() => void | boolean)[];
  /**
   * Executed on resume, without clearing `true` returners.
   * The latter should be idempotent, e.g. reject, resolve.
   */
  onResumes: (() => void | boolean)[];
  positionals: string[];
  /**
   * Variables specified locally in this process.
   * Particularly helpful for background processes and subshells,
   * which have their own PWD and OLDPWD.
   */
  localVar: Record<string, any>;
  /**
   * Inherited local variables.
   */
  inheritVar: Record<string, any>;
}

export interface TtyLinkCtxt {
  lineText: string;
  /** For example `[foo]` has link text `foo` */
  linkText: string;
  /** Where `linkText` occurs in `lineText` */
  linkStartIndex: number;
  /** Callback associated with link */
  callback: () => void;
}

const useStore = create<State>()(devtools((set, get): State => ({
  device: {},
  session: {},
  //@ts-ignore
  persist: {},

  api: {
    addFunc(sessionKey, funcName, file) {
      api.getSession(sessionKey).func[funcName] = {
        key: funcName,
        node: file,
        src: srcService.multilineSrc(file),
      };
    },

    addTtyLineCtxts(sessionKey, lineText, ctxts) {
      const strippedLine = stripAnsi(lineText); // Expect stripped?
      api.getSession(sessionKey).ttyLink[strippedLine] = ctxts.map(x =>
        // We strip ANSI colour codes for string comparison
        ({ ...x, lineText: strippedLine, linkText: stripAnsi(x.linkText) })
      );
    },

    cleanTtyLink(sessionKey) {// 🚧 only run sporadically
      const session = api.getSession(sessionKey);
      const lineLookup = session.ttyShell.xterm.getLines();
      const { ttyLink } = session;
      Object.keys(ttyLink).forEach(lineText =>
        !lineLookup[lineText] && delete ttyLink[lineText]
      );
    },

    createFifo(key, size) {
      const fifo = new FifoDevice(key, size);
      return get().device[fifo.key] = fifo;
    },

    createProcess({ sessionKey, ppid, pgid, src, posPositionals }) {
      const pid = get().api.getNextPid(sessionKey);
      const processes = get().api.getSession(sessionKey).process;
      processes[pid] = {
        key: pid,
        ppid,
        pgid,
        sessionKey,
        status: ProcessStatus.Running,
        src,
        positionals: ['jsh', ...posPositionals || []],
        cleanups: [],
        onSuspends: [],
        onResumes: [],
        localVar: {},
        inheritVar: {},
      };
      return processes[pid];
    },

    createSession(sessionKey, env) {
      const persisted = api.rehydrate(sessionKey);
      const ttyIo = makeShellIo<MessageFromXterm, MessageFromShell>();
      const ttyShell = new ttyShellClass(sessionKey, ttyIo, persisted.history || []);
      get().device[ttyShell.key] = ttyShell;
      get().device['/dev/null'] = new NullDevice('/dev/null');

      set(({ session }) => ({
        session: addToLookup({
          key: sessionKey,
          func: {},
          ttyIo,
          ttyShell,
          ttyLink: {},
          var: {
            PWD: 'home',
            OLDPWD: '',
            ...persisted.var,
            ...deepClone(env),
          },
          nextPid: 0,
          process: {},
          lastExitCode: 0,
        }, session),
      }));
      return get().session[sessionKey];
    },

    createVarDevice(meta, varPath, mode) {
      const device = new VarDevice(meta, varPath, mode);
      return get().device[device.key] = device;
    },

    getFunc(sessionKey, funcName) {
      return get().session[sessionKey].func[funcName] || undefined;
    },

    getFuncs(sessionKey) {
      return Object.values(get().session[sessionKey].func);
    },

    getNextPid(sessionKey) {
      return get().session[sessionKey].nextPid++;
    },

    getPositional(pid, sessionKey, varName) {
      return get().session[sessionKey].process[pid].positionals[varName] || '';
    },

    getProcess({ pid, sessionKey }) {
      return get().session[sessionKey].process[pid];
    },

    getProcesses(sessionKey, pgid) {
      const session = get().session[sessionKey];
      if (session) {
        const processes = Object.values(session.process);
        return pgid === undefined ? processes : processes.filter(x => x.pgid === pgid);
      } else {
        console.warn(`getProcesses: session ${sessionKey} does not exist`)
        return [];
      }
    },

    getVar(meta, varName): any {
      const process = api.getProcess(meta);
      if (varName in process?.localVar) {
        // Got locally specified variable
        return process.localVar[varName];
      } else if (varName in process?.inheritVar) {
        // Got variable locally specified in ancestral process 
        return process.inheritVar[varName];
      } else {
        // Got top-level variable in "file-system" e.g. /home/foo
        return get().session[meta.sessionKey].var[varName];
      }
    },

    getVarDeep(meta, varPath) {
      const session = get().session[meta.sessionKey];
      /**
       * Can deep get /home/* and /etc/*
       * TODO support deep get of local vars?
       */
      const root = { home: session.var, etc: scriptLookup };
      const parts = computeNormalizedParts(varPath, api.getVar(meta, 'PWD') as string);
      return Function('__', `return ${JSON.stringify(parts)}.reduce((agg, x) => agg[x], __)`)(root);
    },

    getSession(sessionKey) {
      return get().session[sessionKey];
    },

    onTtyLink(sessionKey, lineText, linkText, linkStartIndex) {
      // console.log(
      //   'onTtyLink',
      //   { lineText, linkText, linkStartIndex },
      //   api.getSession(sessionKey).ttyLink,
      //   api.getSession(sessionKey).ttyLink[lineText],
      // );
      // api.cleanTtyLink(sessionKey);
      api.getSession(sessionKey).ttyLink[lineText]?.find(x =>
        x.linkStartIndex === linkStartIndex
        && x.linkText === linkText
      )?.callback();
    },

    persist(sessionKey) {
      const { ttyShell, var: varLookup } = api.getSession(sessionKey);

      tryLocalStorageSet(
        `history@session-${sessionKey}`,
        JSON.stringify(ttyShell.getHistory()),
      );

      tryLocalStorageSet(`var@session-${sessionKey}`, JSON.stringify(
        mapValues(varLookup, x => {
          try {// Unserializable vars are ignored
            return JSON.parse(JSON.stringify(x));
          } catch {};
        }),
      ));
    },

    rehydrate(sessionKey) {
      try {
        const storedHistory = JSON.parse(tryLocalStorageGet(`history@session-${sessionKey}`) || 'null');
        const storedVar = JSON.parse(tryLocalStorageGet(`var@session-${sessionKey}`) || 'null');
        return { history: storedHistory, var: storedVar };
      } catch (e) {// Can fail in CodeSandbox in Chrome Incognito
        console.error(e);
        return { history: null, var: null };
      }
    },
    removeDevice(deviceKey) {
      delete get().device[deviceKey];
    },

    removeProcess(pid, sessionKey) {
      const processes = get().session[sessionKey].process;
      delete processes[pid];
    },

    removeSession(sessionKey) {
      const session = get().session[sessionKey];
      if (session) {
        const { process, ttyShell } = get().session[sessionKey];
        ttyShell.dispose();
        Object.values(process).forEach(killProcess);
        delete get().device[ttyShell.key];
        set(({ session }) => ({ session: removeFromLookup(sessionKey, session) }));
      } else {
        console.log(`removeSession: ${sessionKey}: cannot remove non-existent session`);
      }
    },

    removeTtyLineCtxts(sessionKey, lineText) {
      const strippedLine = stripAnsi(lineText); // Expect stripped?
      delete api.getSession(sessionKey).ttyLink[strippedLine];
    },

    resolve(fd, meta) {
      return get().device[meta.fd[fd]];
    },

    setVar(meta, varName, varValue) {
      const session = api.getSession(meta.sessionKey);
      const process = session.process[meta.pid];
      if (
        varName in process?.localVar
        || varName in process?.inheritVar
      ) {
        /**
         * One can set a local variable from an ancestral process,
         * but it will only change the value in current process.
         */
        process.localVar[varName] = varValue;
      } else {
        session.var[varName] = varValue;
      }
    },

    setVarDeep(meta, varPath, varValue) {

      const session = api.getSession(meta.sessionKey);
      const process = session.process[meta.pid];
      const parts = varPath.split('/');

      let root: Record<string, any>, normalParts: string[];

      /**
       * We support writing to local process variables,
       * e.g. `( cd && echo 'pwn3d!'>PWD && pwd )`
       */
      const localCtxt = parts[0] in process.localVar
        ? process.localVar
        : parts[0] in process.inheritVar ? process.inheritVar : null
      ;
        
      if (localCtxt) {
        root = localCtxt;
        normalParts = parts;
      } else {
        root = { home : session.var };
        normalParts = computeNormalizedParts(varPath, api.getVar(meta, 'PWD') as string);

        if (!(normalParts[0] === 'home' && normalParts.length > 1)) {
          throw new ShError('only the home directory is writable', 1);
        }
      }

      try {
        const leafKey = normalParts.pop() as string;
        const parent = resolveNormalized(normalParts, root);
        parent[leafKey] = varValue;
      } catch (e) {
        throw new ShError(`cannot resolve /${normalParts.join('/')}`, 1);
      }

    },

    writeMsg(sessionKey, msg, level) {
      api.getSession(sessionKey).ttyIo.write({ key: level, msg });
    },

    async writeMsgCleanly(sessionKey, msg, opts) {
      const { xterm } = api.getSession(sessionKey).ttyShell;
      xterm.prepareForCleanMsg();
      await new Promise<void>(resolve => {
        xterm.queueCommands([
          { key: 'line', line: `${msg}${ansi.Reset}` },
          { key: 'resolve', resolve },
        ])
      });
      opts?.ttyLinkCtxts && api.addTtyLineCtxts(sessionKey, msg, opts.ttyLinkCtxts);
      setTimeout(() => {
        (opts?.prompt??true) && xterm.showPendingInput();
        xterm.xterm.scrollToBottom();
      });
    },
  },

}), { name: "session.store" }));

const api = useStore.getState().api;
const useSessionStore = Object.assign(useStore, { api });

export default useSessionStore;

// if (module.hot) {// Avoid breaking preact-prefresh
//   module.hot.accept();
// }
