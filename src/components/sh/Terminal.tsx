import React from 'react';
import { css } from '@emotion/css';
import { IDisposable, Terminal as XTermTerminal } from 'xterm';
import loadable from '@loadable/component';
import useMeasure from 'react-use-measure';
import { FitAddon } from 'xterm-addon-fit';

import { ttyXtermClass } from 'projects/sh/tty.xterm';
import { ansi } from 'projects/service/const';
import { canTouchDevice } from 'projects/service/dom';

import { formatMessage, stripAnsi } from 'projects/sh/util';
import useSession, { ProcessStatus, Session } from 'projects/sh/session.store';
import { scrollback } from 'projects/sh/io';

import useStateRef from 'projects/hooks/use-state-ref';
import type ActualTouchHelperUi from './TouchHelperUi';
import useUpdate from 'projects/hooks/use-update';
import { LinkProvider } from './xterm-link-provider';

export default function Terminal(props: Props) {

  const update = useUpdate();

  // 🔔 Saw cursor preservation fail at debounce 20
  const [rootRef, bounds] = useMeasure({ debounce: 0, scroll: false });

  const state = useStateRef(() => ({
    bounds,
    cleanup: () => {},
    container: {} as HTMLDivElement,
    cursorBeforePause: undefined as number | undefined,
    fitAddon: new FitAddon,
    focusedBeforePause: false,
    hasEverDisabled: false,
    inputOnFocus: undefined as undefined | { input: string; cursor: number },
    isTouchDevice: canTouchDevice(),
    onFocus() {
      if (state.inputOnFocus) {
        state.xterm.setInput(state.inputOnFocus.input);
        state.xterm.setCursor(state.inputOnFocus.cursor);
        state.inputOnFocus = undefined;
      }
    },
    pausedPids: {} as Record<number, true>,
    ready: false,
    async resize() {
      if (state.isTouchDevice) {
        state.fitAddon.fit();
      } else {
        const input = state.xterm.getInput();
        const cursor = state.xterm.getCursor();
        if (input && state.xterm.isPromptReady()) {
          state.xterm.clearInput();
          state.inputOnFocus = { input, cursor };
        }
        setTimeout(() => state.fitAddon.fit());
      }
    },
    session: {} as Session,
    xterm: {} as ttyXtermClass,
  }));

  React.useEffect(() => {// Create session
    if (!props.disabled && !state.ready) {

      state.session = useSession.api.createSession(props.sessionKey, props.env);

      const xterm = new XTermTerminal({
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
      });
      xterm.registerLinkProvider(new LinkProvider(
        xterm,
        /(\[ [^\]]+ \])/gi,
        async function callback(_event, linkText, { lineText, linkStartIndex, lineNumber }) {
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
      ));

      state.xterm = new ttyXtermClass(xterm, {
        key: state.session.key,
        io: state.session.ttyIo,
        rememberLastValue(msg) { state.session.var._ = msg },
      });
      state.xterm.initialise();
      state.session.ttyShell.initialise(state.xterm);

      const onKeyDisposable = xterm.onKey(e => props.onKey?.(e.domEvent));
      xterm.loadAddon(state.fitAddon);
      xterm.open(state.container);
      state.resize();
      xterm.textarea?.addEventListener('focus', state.onFocus);

      state.cleanup = () => {
        onKeyDisposable.dispose();
        xterm.dispose();
      };

      state.ready = true;
      update();
    }
  }, [props.disabled]);

  React.useEffect(() => {// Handle session pause/resume
    if (!state.ready) {
      return;
    }

    if (props.disabled) {// Pause
      state.hasEverDisabled = true;
      state.focusedBeforePause = document.activeElement === state.xterm.xterm.textarea;

      if (state.xterm.isPromptReady()) {
        state.cursorBeforePause = state.xterm.getCursor();
        state.xterm.showPendingInputImmediately(); // Moves cursor to end
      } else {
        state.cursorBeforePause = undefined;
      }

      useSession.api.writeMsgCleanly(
        props.sessionKey,
        formatMessage(`${ansi.White}paused`, 'info'),
        { prompt: false },
      );

      // Pause running processes
      Object.values((state.session.process)??{}).filter(
        p => p.status === ProcessStatus.Running,
      ).forEach(p => {
        p.onSuspends = p.onSuspends.filter(onSuspend => onSuspend());
        p.status = ProcessStatus.Suspended;
        state.pausedPids[p.key] = true;
      });
    }

    if (!props.disabled && state.hasEverDisabled) {// Resume
      state.focusedBeforePause && state.xterm.xterm.focus();

      // overwrite "paused" with "resumed"
      const extraNewlines = Math.max(1, state.xterm.numLines() + (state.xterm.active.cursorY + 1) - state.xterm.rows);
      state.xterm.xterm.write(`\x1b[F\x1b[2K${formatMessage(`${ansi.White}resumed`, 'info')}\r${'\r\n'.repeat(extraNewlines)}`);
      state.xterm.showPendingInputImmediately();
        
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
    state.session = state.xterm = {} as any;
    state.ready = false;
    state.cleanup();
  }, []);

  React.useEffect(() => {
    state.bounds = bounds;
    state.ready && state.resize();
  }, [bounds]);

  return (
    <div
      className={rootCss}
      ref={rootRef}
    >
      <div
        ref={el => el && (state.container = el)}
        className="xterm-container scrollable"
        onKeyDown={stopKeysPropagating}
      />
    
      {state.ready &&
        <TouchHelperUi
          session={state.session}
          disabled={props.disabled}
        />
      }
    </div>
  );
};

interface Props {
  disabled?: boolean;
  /** Can initialize variables */
  env: Partial<Session['var']>;
  onKey?: (e: KeyboardEvent) => void;
  sessionKey: string;
}

const rootCss = css`
  /* background: purple; */
  height: 100%;
  padding: 4px;

  .xterm-container {
    height: inherit;
    background: black;
    /* background: yellow; */
    
    > div {
      width: 100%;
    }
    
    /** Fix xterm-addon-fit when open keyboard on mobile */
    .xterm-helper-textarea {
      top: 0 !important;
    }
    
    /** This hack avoids <2 col width, where cursor row breaks */
    min-width: 100px;
    .xterm-screen {
      min-width: 100px;
    }
  }
`;

const TouchHelperUi = loadable(
  () => import('./TouchHelperUi'),
  { ssr: false },
) as typeof ActualTouchHelperUi;

function stopKeysPropagating(e: React.KeyboardEvent) {
  e.stopPropagation();
}
