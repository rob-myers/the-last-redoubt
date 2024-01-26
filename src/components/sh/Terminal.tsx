import React from 'react';
import { css } from '@emotion/css';
import { Terminal as XTermTerminal } from 'xterm';
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

  const [rootRef, bounds] = useMeasure({ debounce: 0, scroll: false });

  const state = useStateRef(() => ({
    bounds,
    beforeResize: undefined as { cursor: number; input: string; } | undefined,
    changedWidth: false,
    cleanup: () => {},
    container: {} as HTMLDivElement,
    cursorBeforePause: undefined as number | undefined,
    fitAddon: new FitAddon,
    focusedBeforePause: false,
    hasEverDisabled: false,
    isTouchDevice: canTouchDevice(),
    onFocus() {
      if (state.beforeResize) {
        state.ttyXterm.clearInput();
        state.ttyXterm.setInput(state.beforeResize.input);
        state.ttyXterm.setCursor(state.beforeResize.cursor);
        state.beforeResize = undefined;
      }
    },
    pausedPids: {} as Record<number, true>,
    ready: false,
    resize() {
      if (state.changedWidth && state.ttyXterm.getInput()) {
        state.beforeResize = { input: state.ttyXterm.getInput(), cursor: state.ttyXterm.getCursor() };
        state.ttyXterm.clearInput();
        state.ttyXterm.xterm.write(`${ansi.BrightGreenBg}...${ansi.Reset}`);
      }
      // Saw error: This API only accepts integers
      try { state.fitAddon.fit(); } catch {}
    },
    session: {} as Session,
    ttyXterm: {} as ttyXtermClass,
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

      state.ttyXterm = new ttyXtermClass(xterm, {
        key: state.session.key,
        io: state.session.ttyIo,
        rememberLastValue(msg) { state.session.var._ = msg },
      });
      state.ttyXterm.initialise();
      state.session.ttyShell.initialise(state.ttyXterm);

      const onKeyDisposable = xterm.onKey(e => props.onKey?.(e.domEvent));
      xterm.loadAddon(state.fitAddon);
      window.addEventListener('resize', state.resize);
      xterm.open(state.container);
      state.resize();
      xterm.textarea?.addEventListener('focus', state.onFocus);

      state.cleanup = () => {
        window.removeEventListener('resize', state.resize);
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
      Object.values((state.session.process)??{}).filter(
        p => p.status === ProcessStatus.Running,
      ).forEach(p => {
        p.onSuspends = p.onSuspends.filter(onSuspend => onSuspend());
        p.status = ProcessStatus.Suspended;
        state.pausedPids[p.key] = true;
      });
    }

    if (!props.disabled && state.hasEverDisabled) {
      state.focusedBeforePause && state.session.ttyShell.xterm.xterm.focus();
      
      // if pending input will overwrite "paused/resumed session",
      // split it via an interactive prompt
      if (ttyXterm.numLines() > 1 && (ttyXterm.xterm.buffer.active.cursorY + 1) + ttyXterm.numLines() + 2 >= ttyXterm.xterm.rows) {
        state.session.ttyShell.xterm.nextInteractivePrompt();
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
    state.session = state.ttyXterm = {} as any;
    state.ready = false;
    state.cleanup();
  }, []);

  React.useEffect(() => {
    state.changedWidth = state.bounds.width !== bounds.width;
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
