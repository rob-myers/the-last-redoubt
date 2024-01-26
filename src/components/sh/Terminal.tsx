import React from 'react';
import { css } from '@emotion/css';
import type { ITerminalOptions } from 'xterm';
import loadable from '@loadable/component';

import { ttyXtermClass } from 'projects/sh/tty.xterm';
import { ansi } from 'projects/service/const';
import { canTouchDevice } from 'projects/service/dom';
import { assertNonNull } from 'projects/service/generic';

import { formatMessage, stripAnsi } from 'projects/sh/util';
import useSession, { ProcessStatus, Session } from 'projects/sh/session.store';
import { scrollback } from 'projects/sh/io';

import useOnResize from 'projects/hooks/use-on-resize';
import useStateRef from 'projects/hooks/use-state-ref';
import XTerm from './XTerm';
import type ActualTouchHelperUi from './TouchHelperUi';
import useUpdate from 'projects/hooks/use-update';

export default function Terminal(props: Props) {

  const update = useUpdate();

  const state = useStateRef(() => ({
    cursorBeforePause: undefined as number | undefined,
    focusedBeforePause: false,
    hasEverDisabled: false,
    isTouchDevice: canTouchDevice(),
    pausedPids: {} as Record<number, true>,
    session: null as null | Session,
    /** `session` non-null and initialised */
    xtermReady: false,
  }));

  useOnResize(() => state.isTouchDevice = canTouchDevice());

  React.useEffect(() => {// Create new session
    if (!props.disabled && state.session === null && !state.xtermReady) {
      update(); // Ensure <XTerm> unmount i.e. xterm.dispose(), during HMR
      const id = setTimeout(() => {
        state.session = useSession.api.createSession(props.sessionKey, props.env);
        update();
      });
      return () => clearTimeout(id);
    }
  }, [props.disabled]);

  React.useEffect(() => {// Handle session pause/resume
    if (!state.xtermReady || !state.session) {
      return;
    }
    const ttyXterm = state.session.ttyShell.xterm;

    if (props.disabled) {
      state.hasEverDisabled = true;
      state.focusedBeforePause = document.activeElement === ttyXterm.xterm.textarea;

      if (ttyXterm.isPromptReady()) {
        state.cursorBeforePause = ttyXterm.getCursor();
        ttyXterm.showPendingInputImmediately(); // Moves cursor to end
      } else {
        state.cursorBeforePause = undefined;
      }

      useSession.api.writeMsgCleanly(
        props.sessionKey,
        formatMessage(`${ansi.White}paused session`, 'info'),
        { prompt: false },
      );

      // Pause running processes
      Object.values((state.session?.process)??{}).filter(
        p => p.status === ProcessStatus.Running,
      ).forEach(p => {
        p.onSuspends = p.onSuspends.filter(onSuspend => onSuspend());
        p.status = ProcessStatus.Suspended;
        state.pausedPids[p.key] = true;
      });
    }

    if (!props.disabled && state.hasEverDisabled) {
      state.focusedBeforePause && state.session?.ttyShell.xterm.xterm.focus();
      
      // if pending input will overwrite "paused/resumed session",
      // split it via an interactive prompt
      if (ttyXterm.numLines() > 1 && (ttyXterm.xterm.buffer.active.cursorY + 1) + ttyXterm.numLines() + 2 >= ttyXterm.xterm.rows) {
        state.session.ttyShell.xterm.nextInteractivePrompt(true);
      }

      useSession.api.writeMsgCleanly(
        props.sessionKey,
        formatMessage(`${ansi.White}resumed session`, 'info'),
        { cursor: state.cursorBeforePause },
      );
        
      // Resume processes we suspended
      const processes = Object.values((state.session?.process)??{});
      processes.filter(
        p => state.pausedPids[p.key]
      ).forEach(p => {
        if (p.status === ProcessStatus.Suspended) {
          p.onResumes = p.onResumes.filter(onResume => onResume());
          p.status = ProcessStatus.Running;
        }
        delete state.pausedPids[p.key];
      });
    }
  }, [props.disabled]);

  React.useEffect(() => () => {// Destroy session
    useSession.api.removeSession(props.sessionKey);
    state.session = null;
    state.xtermReady = false;
  }, []);

  return state.session ? (
    <div className={rootCss}>

      <XTerm
        onMount={(xterm) => {// `xterm` is an xterm.js instance
          const session = assertNonNull(state.session);
          const ttyXterm = new ttyXtermClass(xterm, {
            key: session.key,
            io: session.ttyIo,
            rememberLastValue(msg) { session.var._ = msg },
          });

          ttyXterm.initialise();
          session.ttyShell.initialise(ttyXterm);
          state.xtermReady = true;
          const disposable = xterm.onKey(e => props.onKey?.(e.domEvent));

          update();

          return { ttyXterm, cleanups: [() => disposable.dispose()] };
        }}
        options={options}
        linkProviderDef={{
          /**
           * Links look like this:
           * - [ foo bar ]
           * - [ 1 ]
           */
          regex: /(\[ [^\]]+ \])/gi,
          // regex: /(\[[^\]]+\])/gi,
          async callback(_event, linkText, { lineText, linkStartIndex, lineNumber }) {
            // console.log('clicked link', {
            //   sessionKey: props.sessionKey,
            //   linkText,
            //   lineText,
            //   linkStartIndex,
            //   lineNumber,
            // });
            useSession.api.onTtyLink({
              sessionKey: props.sessionKey,
              lineText: stripAnsi(lineText),
              // Omit square brackets and spacing:
              linkText: stripAnsi(linkText).slice(2, -2),
              linkStartIndex,
              lineNumber,
            });
          },
        }}
      />

      {state.xtermReady &&
        <TouchHelperUi
          session={state.session}
          disabled={props.disabled}
        />
      }

    </div>
  ) : null;
};

interface Props {
  disabled?: boolean;
  /** Can initialize variables */
  env: Partial<Session['var']>;
  onKey?: (e: KeyboardEvent) => void;
  sessionKey: string;
}

const rootCss = css`
  /* // DEBUG xterm fit issue
  background: purple; */
  height: 100%;
  padding: 4px;
`;

const options: ITerminalOptions = {
  allowProposedApi: true, // Needed for WebLinksAddon
  fontSize: 16,
  cursorBlink: true,
  rendererType: 'canvas',
  // mobile: can select single word via long press
  rightClickSelectsWord: true,
  theme: {
    background: 'black',
    foreground: '#41FF00',
  },
  convertEol: false,
  scrollback: scrollback,
  rows: 50,
};

const TouchHelperUi = loadable(
  () => import('./TouchHelperUi'),
  { ssr: false },
) as typeof ActualTouchHelperUi;
