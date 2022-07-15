import React from 'react';
import { css } from '@emotion/css';
import { debounce } from 'debounce';
import type { ITerminalOptions } from 'xterm';

import { ttyXtermClass } from 'projects/sh/tty.xterm';
import { canTouchDevice } from 'projects/service/dom';
import { assertNonNull } from 'projects/service/generic';
import { getCached } from 'projects/service/query-client';

import { stripAnsi } from 'projects/sh/util';
import useSession, { ProcessStatus, Session } from 'projects/sh/session.store';
import { scrollback } from 'projects/sh/io';

import useOnResize from 'projects/hooks/use-on-resize';
import useStateRef from 'projects/hooks/use-state-ref';
import XTerm from './XTerm'; // TODO absorb?
import { TouchHelperUI } from './TouchHelperUi';
import useUpdate from 'projects/hooks/use-update';
import type { State as WorldApi } from 'projects/world/World';

export default function Terminal(props: Props) {

  const update = useUpdate();

  const state = useStateRef(() => ({
    isTouchDevice: canTouchDevice(),
    offset: 0,
    session: null as null | Session,
    hasUserDisabled: false,
    xtermReady: false,
  }));

  useOnResize(() => state.isTouchDevice = canTouchDevice());

  React.useEffect(() => {
    if (state.session === null && !props.disabled) {
      state.session = useSession.api.createSession(props.sessionKey, props.env);
      update();
      return;
    }

    if (props.disabled && state.xtermReady) {
      state.hasUserDisabled = true;
      useSession.api.writeMsgCleanly(props.sessionKey, 'ℹ️  paused session', { prompt: false });

      // Pause running processes
      const processes = Object.values((state.session?.process)??{});
      processes.filter(p => p.status === ProcessStatus.Running).forEach(p => {
        p.onSuspends = p.onSuspends.filter(onSuspend => onSuspend());
        p.status = ProcessStatus.Suspended;
      });
    }

    if (!props.disabled && state.hasUserDisabled && state.xtermReady) {
      useSession.api.writeMsgCleanly(props.sessionKey, 'ℹ️  resumed session');

      // Resume suspended processes
      // TODO what if previously suspended?
      const processes = Object.values((state.session?.process)??{});
      processes.filter(p => p.status === ProcessStatus.Suspended).forEach(p => {
        p.onResumes = p.onResumes.filter(onResume => onResume());
        p.status = ProcessStatus.Running;
      });
    }
  }, [props.disabled]);

  React.useEffect(() => () => useSession.api.removeSession(props.sessionKey), []);
  
  return (
    <div className={rootCss}>
      {state.session && (
        <XTerm
          // `xterm` is an xterm.js instance
          onMount={(xterm) => {
            const session = assertNonNull(state.session);
            const ttyXterm = new ttyXtermClass(xterm, {
              key: session.key,
              io: session.ttyIo,
              rememberLastValue: (msg) => session.var._ = msg,
            });
            ttyXterm.initialise();
            session.ttyShell.initialise(ttyXterm);
            state.xtermReady = true;
            update();

            ttyXterm.xterm.onLineFeed(debounce(() => {
              if (state.isTouchDevice) {
                state.offset = Math.max(1, parseInt(xterm.textarea!.style.top) - 100);
                update();
              }
            }, 100));
          }}
          options={options}
          linkProviderDef={{
            // regex: /(🔎 [^;]+);/g,
            regex: /(\[[a-z][^\]]+\])/gi,
            async callback(event, linkText, { outputLineNumber, lineText, linkStartIndex, bufferOutputLines }) {
              // console.log('clicked link', event, linkText, { outputLineNumber, lineText, linkStartIndex, bufferOutputLines });
              const session = assertNonNull(state.session);
              const {npcs} = getCached(session.var.WORLD_KEY) as WorldApi;
              /**
               * Number of "actual" lines output, no longer entirely within tty's buffer.
               * Why do we need the +1?
               */
              const priorOutputLines = Math.max(0, session.ttyShell.xterm.totalLinesOutput - bufferOutputLines + 1);
              npcs.onTtyLink(
                props.sessionKey,
                // The "global" 1-based index of lines ever output by tty
                priorOutputLines + outputLineNumber,
                stripAnsi(lineText),
                stripAnsi(linkText).slice(1, -1), // Omit square brackets
                linkStartIndex,
              );
            },
          }}
        />
      )}
      {state.isTouchDevice && state.session && state.xtermReady &&
        <TouchHelperUI
          session={state.session}
          offset={state.offset}
        />
      }
    </div>
  )
};

interface Props {
  disabled?: boolean;
  sessionKey: string;
  /** Can initialize variables */
  env: { [envVarName: string]: any; };
}

const rootCss = css`
  grid-area: terminal;
  background: black;
  height: 100%;
  padding: 4px;
  /** TODO fix padding without scrollbar offset */
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
