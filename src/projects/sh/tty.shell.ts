import type * as Sh from './parse';
import { testNever } from '../service/generic';
import type { MessageFromShell, MessageFromXterm, ShellIo } from './io';
import { Device, ReadResult, SigEnum } from './io';

import { ansi, ProcessError, ShError } from './util';
import { parseService, srcService } from './parse';
import useSession, { ProcessMeta, ProcessStatus } from './session.store';
import { semanticsService } from './semantics.service';
import { ttyXtermClass } from './tty.xterm';

export class ttyShellClass implements Device {

  public key: string;
  public xterm!: ttyXtermClass;
  /** Lines received from a TtyXterm. */
  private inputs = [] as { line: string; resolve: () => void }[];
  private input = null as null | { line: string; resolve: () => void };
  /** Lines in current interactive parse */
  private buffer = [] as string[];
  private readonly maxLines = 500;
  private process!: ProcessMeta;
  private cleanups = [] as (() => void)[];

  private oneTimeReaders = [] as {
    resolve: (msg: any) => void;
    reject: () => void;
  }[];
 
  constructor(
    public sessionKey: string,
    public io: ShellIo<MessageFromXterm, MessageFromShell>,
    /** Source code entered interactively, most recent last. */
    private history: string[],
  ) {
    this.key = `/dev/tty-${sessionKey}`;
  }

  dispose() {
    this.xterm.dispose();
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups.length = 0;
  }
  
  async initialise(xterm: ttyXtermClass) {
    this.xterm = xterm;
    this.cleanups.push(this.io.read(this.onMessage.bind(this)));

    // session corresponds to leading process where pid = ppid = pgid = 0
    useSession.api.createProcess({
      sessionKey: this.sessionKey,
      ppid: 0,
      pgid: 0,
      src: '',
    });
    this.process = useSession.api.getSession(this.sessionKey).process[0];

    // useSession.api.writeMsg(this.sessionKey, `${ansiColor.White}Connected to session ${ansiColor.Blue}${this.sessionKey}${ansiColor.Reset}`, 'info');
    await this.runProfile();
  }

  private onMessage(msg: MessageFromXterm) {
    switch (msg.key) {
      case 'req-history-line': {
        const { line, nextIndex } = this.getHistoryLine(msg.historyIndex);
        this.io.write({
          key: 'send-history-line',
          line,
          nextIndex,
        });
        break;
      }
      case 'send-line': {
        if (this.oneTimeReaders.length) {
          this.oneTimeReaders.shift()!.resolve(msg.line);
          this.io.write({ key: 'tty-received-line' });
        } else {
          this.inputs.push({
            line: msg.line,
            // xterm won't send another line until resolved
            resolve: () => this.io.write({ key: 'tty-received-line' }),
          });
          this.tryParse();
        }
        break;
      }
      case 'send-kill-sig': {
        this.buffer.length = 0;
        this.oneTimeReaders.forEach(({ reject }) => reject());
        this.oneTimeReaders.length = 0;
        if (this.process.status !== ProcessStatus.Running) {
          this.prompt('$');
        } else {
          semanticsService.handleTopLevelProcessError(
            new ProcessError(SigEnum.SIGKILL, 0, this.sessionKey),
          );
        }
        break;
      }
      default:
        throw testNever(msg, { suffix: 'onMessage' });
    }
  }

  private getHistoryLine(lineIndex: number) {
    const maxIndex = this.history.length - 1;
    return {
      line: this.history[maxIndex - lineIndex] || '',
      nextIndex: lineIndex < 0 ? 0 : lineIndex > maxIndex ? maxIndex : lineIndex,
    };
  }

  getHistory() {
    return this.history.slice();
  }

  /** `prompt` must not contain non-readable characters e.g. ansi color codes */
  private prompt(prompt: string) {
    this.io.write({
      key: 'send-xterm-prompt',
      prompt: `${prompt} `,
    });    
  }

  private provideContextToParsed(parsed: Sh.FileWithMeta) {
    Object.assign<Sh.BaseMeta, Sh.BaseMeta>(parsed.meta, {
      sessionKey: this.sessionKey,
      pid: 0,
      ppid: 0,
      pgid: 0,
      fd: { 0: this.key, 1: this.key, 2: this.key },
      stack: [],
      verbose: false, // TODO runtime configurable
    });
  }

  /**
   * We run the profile by pasting it into the terminal.
   * This explicit approach can be avoided via `source`.
   */
  private async runProfile() {
    const profile = useSession.api.getVar(
      { pid: 0, sessionKey: this.sessionKey } as Sh.BaseMeta,
      'PROFILE',
    ) || '';
    const { ttyShell } = useSession.api.getSession(this.sessionKey);

    try {
      ttyShell.xterm.historyEnabled = false;
      useSession.api.writeMsg(this.sessionKey, `${ansi.Blue}${this.sessionKey}${ansi.White} running ${ansi.Blue}/home/PROFILE${ansi.Reset}`, 'info');
      await ttyShell.xterm.pasteLines(profile.split('\n'), true);
      this.prompt('$');
    } catch {} finally {
      ttyShell.xterm.historyEnabled = true;
    }
  }

  /** Spawn a process, assigning pid to non-leading ones */
  async spawn(
    parsed: Sh.FileWithMeta,
    opts: {
      cleanups?: (() => void)[];
      leading?: boolean;
      localVar?: boolean;
      posPositionals?: string[];
    } = {},
  ) {
    const { meta } = parsed;

    if (opts.leading) {
      this.process.status = ProcessStatus.Running;
    } else {
      const { ppid, pgid } = meta;
      const { positionals } = useSession.api.getProcess(meta);
      const process = useSession.api.createProcess({
        ppid,
        pgid,
        sessionKey: meta.sessionKey,
        src: srcService.src(parsed),
        posPositionals: opts.posPositionals || positionals.slice(1),
      });
      meta.pid = process.key;
      opts.cleanups && process.cleanups.push(...opts.cleanups);

      const session = useSession.api.getSession(meta.sessionKey);
      const parent = session.process[meta.ppid]; // Exists
      // Shallow clone avoids mutation by descendants
      process.inheritVar = { ...parent.inheritVar };
      if (opts.localVar) {
        // Sometimes processes (e.g. background, subshell) need their own PWD
        process.localVar.PWD = (parent.inheritVar.PWD)??session.var.PWD;
        process.localVar.OLDPWD = (parent.inheritVar.OLDPWD)??session.var.OLDPWD;
      }
      // console.warn(ppid, 'launched', meta.pid, process, JSON.stringify(meta.fd));
    }

    try {
      for await (const _ of semanticsService.File(parsed)) { /** NOOP */ }
      parsed.meta.verbose && console.warn(`${meta.sessionKey}${meta.pgid ? ' (background)' : ''}: ${meta.pid}: exit ${parsed.exitCode}`);
    } catch (e) {
      if (e instanceof ProcessError) {
        console.error(`${meta.sessionKey}${meta.pgid ? ' (background)' : ''}: ${meta.pid}: ${e.code}`);
        // Ctrl-C code is 130 unless overriden
        parsed.exitCode = e.exitCode ?? 130; // 🚧 or 137?
      } else if (e instanceof ShError) {
        parsed.exitCode = e.exitCode;
      }
      throw e;
    } finally {
      const session = useSession.api.getSession(this.sessionKey);

      if (!session) {
        return console.warn(`session ${this.sessionKey} no longer exists`);
      } else if (typeof parsed.exitCode === 'number') {
        // 🤔 only pid 0 and parent's of pipes can set lastExitCode
        (meta.ppid === meta.pid) && (session.lastExitCode = parsed.exitCode);
        // session.lastExitCode = parsed.exitCode;
      } else {
        console.warn(`process ${meta.pid} had no exitCode`);
      }
      /**
       * Can have `!opts.leading && meta.pid === 0` because ...
       */
      !opts.leading && meta.pid && useSession.api.removeProcess(meta.pid, this.sessionKey);
    }
  }

  private storeSrcLine(srcLine: string) {
    const prev = this.history.pop();
    prev && this.history.push(prev);
    if (prev !== srcLine) {
      this.history.push(srcLine);
      while (this.history.length > this.maxLines) this.history.shift();
      useSession.api.persist(this.sessionKey);
    }
  }

  private async tryParse() {
    this.input = this.inputs.pop() || null;
    if (!this.input) return;

    try {// Catch errors from `this.spawn`

      this.buffer.push(this.input.line);
      const result = parseService.tryParseBuffer(this.buffer.slice());

      switch (result.key) {
        case 'failed': {
          this.xterm.shouldEcho = true;
          const errMsg = `mvdan-sh: ${result.error.replace(/^src\.sh:/, '')}`;
          console.error(errMsg);
          this.io.write({ key: 'error', msg: errMsg });
          this.buffer.length = 0;
          this.prompt('$');
          break;
        }
        case 'complete': {
          this.xterm.shouldEcho = true;
          this.buffer.length = 0;
          const singleLineSrc = srcService.src(result.parsed);
          if (singleLineSrc && this.xterm.historyEnabled) {
            this.storeSrcLine(singleLineSrc); // Store command in history
          }

          // Run command
          this.process.src = singleLineSrc;
          this.provideContextToParsed(result.parsed);
          await this.spawn(result.parsed, { leading: true });

          this.prompt('$');
          break;
        }
        case 'incomplete': {
          this.prompt('>');
          break;
        }
      }
    } catch (e) {
      if (e instanceof ProcessError) {
        semanticsService.handleTopLevelProcessError(e);
      } else {
        console.error('unexpected error propagated to tty.shell', e);
      }
      this.prompt('$');
    } finally {
      this.input?.resolve();
      this.input = null;
      this.process.status = ProcessStatus.Suspended;
    }
  }

  //#region Device
  public async readData(): Promise<ReadResult> {
    try {
      return await new Promise((resolve, reject) => {
        this.oneTimeReaders.push({
          resolve: (msg: string) => resolve({ data: msg }),
          reject,
        });
        this.input?.resolve();
        this.input = null;
      });
    } catch {
      return { eof: true };
    }
  }
  public async writeData(data: any) {
    this.io.write(data);
  }
  public finishedWriting() {
    // NOOP
  }
  /**
   * Background processes are not allowed to read from TTY.
   * We further assume there is at most one interactive process reading it.
  */
  public finishedReading() {
    this.buffer.length = 0;
    this.oneTimeReaders.forEach(({ reject }) => reject());
    this.oneTimeReaders.length = 0;
  }
  //#endregion
}
