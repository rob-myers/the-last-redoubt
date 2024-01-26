import React from 'react';
import { css, cx } from '@emotion/css';
import { ITerminalOptions, Terminal as XTermTerminal } from 'xterm';
import loadable from '@loadable/component';
import useMeasure from 'react-use-measure';
import { FitAddon } from 'xterm-addon-fit';

import { ttyXtermClass } from 'projects/sh/tty.xterm';
import { ansi } from 'projects/service/const';
import { canTouchDevice } from 'projects/service/dom';

import { formatMessage, stripAnsi } from 'projects/sh/util';
import useSession, { ProcessStatus, Session } from 'projects/sh/session.store';
import { scrollback } from 'projects/sh/io';

import useOnResize from 'projects/hooks/use-on-resize';
import useStateRef from 'projects/hooks/use-state-ref';
import type ActualTouchHelperUi from './TouchHelperUi';
import useUpdate from 'projects/hooks/use-update';
import { LinkProvider } from './xterm-link-provider';

export default function Terminal(props: Props) {

  const update = useUpdate();

  const state = useStateRef(() => ({
    cleanups: [] as (() => void)[],
    container: {} as HTMLDivElement,
    cursorBeforePause: undefined as number | undefined,
    fitAddon: new FitAddon,
    focusedBeforePause: false,
    hasEverDisabled: false,
    isTouchDevice: canTouchDevice(),
    pausedPids: {} as Record<number, true>,
    resize() {
      try {
        state.session?.ttyShell.xterm.nextInteractivePrompt(false);
        state.fitAddon.fit();
      } catch {
        // Saw error: This API only accepts integers
      }
    },
    session: null as null | Session,
    xterm: null as null | XTermTerminal,
  }));

  useOnResize(() => state.isTouchDevice = canTouchDevice());

  React.useEffect(() => {// Create session
    if (!props.disabled && state.session === null) {

      const session = state.session = useSession.api.createSession(props.sessionKey, props.env);

      const xterm = state.xterm = new XTermTerminal(options);

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

      const ttyXterm = new ttyXtermClass(xterm, {
        key: session.key,
        io: session.ttyIo,
        rememberLastValue(msg) { session.var._ = msg },
      });
      ttyXterm.initialise();
      session.ttyShell.initialise(ttyXterm);
      const onKeyDisposable = xterm.onKey(e => props.onKey?.(e.domEvent));

      xterm.loadAddon(state.fitAddon);
      window.addEventListener('resize', state.resize);
      xterm.open(state.container);
      state.resize();

      state.cleanups = [
        () => window.removeEventListener('resize', state.resize),
        () => onKeyDisposable.dispose(),
        () => xterm.dispose(),
      ];

      update();
    }
  }, [props.disabled]);

  React.useEffect(() => {// Handle session pause/resume
    if (!state.session) {
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
    state.session = state.xterm = null;
    state.cleanups.forEach(cleanup => cleanup());
    state.cleanups.length = 0;
  }, []);

  const [rootRef, bounds] = useMeasure({ debounce: 0, scroll: false });

  React.useEffect(() => void state.resize(), [bounds]);

  return (
    <div
      className={rootCss}
      ref={rootRef}
    >
      <div
        ref={el => el && (state.container = el)}
        className={cx("xterm-container", "scrollable", containerCss)}
        onKeyDown={stopKeysPropagating}
      />
    
      {state.session &&
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
`;

const containerCss = css`
  height: inherit;
  /* background: yellow; // DEBUG */
  background: black;

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

function stopKeysPropagating(e: React.KeyboardEvent) {
  e.stopPropagation();
}
