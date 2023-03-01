import React from 'react';
import { css, cx } from '@emotion/css';
import { tryLocalStorageGet, tryLocalStorageSet } from 'projects/service/generic';
import { zIndex } from 'projects/service/const';
import type { Session } from 'projects/sh/session.store';
import useStateRef from 'projects/hooks/use-state-ref';
import useSessionStore from 'projects/sh/session.store';

export default function TouchHelperUI(props: {
  session: Session;
  disabled?: boolean;
}) {

  const state = useStateRef(() => {
    return {
      async onClick(e: React.MouseEvent) {
        const target = e.target as HTMLElement;
        const { xterm } = props.session.ttyShell;
        xterm.xterm.scrollToBottom();
        if (target.classList.contains('paste')) {
          try {
            const textToPaste = await navigator.clipboard.readText();
            xterm.spliceInput(textToPaste);
          } catch {}
        } else if (target.classList.contains('lowercase')) {
          const forced = (xterm.forceLowerCase = !xterm.forceLowerCase);
          const message = `⚠️  input ${forced ? 'forced as' : 'not forced as'} lowercase`;
          useSessionStore.api.writeMsgCleanly(props.session.key, message);
          target.classList.toggle('enabled');
          tryLocalStorageSet(localStorageKey, `${forced}`);
        } else if (target.classList.contains('ctrl-c')) {
          xterm.sendSigKill();
        } else if (target.classList.contains('clear')) {
          xterm.clearScreen();
        } else if (target.classList.contains('up')) {
          xterm.reqHistoryLine(+1);
        } else if (target.classList.contains('down')) {
          xterm.reqHistoryLine(-1);
        } 
        // xterm.xterm.focus();
      },
    };
  });
  
  React.useMemo(() => {
    const { xterm } = props.session.ttyShell;
    if (!tryLocalStorageGet(localStorageKey)) {
      // force lowercase by default on touch device
      tryLocalStorageSet(localStorageKey, 'true');
    }
    xterm.forceLowerCase = tryLocalStorageGet(localStorageKey) === 'true';
    return () => void (xterm.forceLowerCase = false);
  }, []);

  return (
    <div
      className={cx(rootCss, { disabled: props.disabled })}
      onClick={state.onClick}
    >
      <div className="icon paste">
        paste
      </div>
      <div className={cx(
        'icon lowercase',
        { enabled: props.session.ttyShell.xterm.forceLowerCase },
      )}>
        abc
      </div>
      <div className="icon ctrl-c">
        💀
      </div>
      <div className="icon clear">
        ∅
      </div>
      <div className="icon up">
        ⬆️
      </div>
      <div className="icon down">
        ⬇️
      </div>
    </div>
  );
}

const localStorageKey = 'touch-tty-force-lowercase';

const rootCss = css`
  position: absolute;
  z-index: ${zIndex.ttyTouchHelper};
  top: 0;
  right: 0;

  &.disabled {
    filter: brightness(0.5);
    pointer-events: none;
  }

  line-height: 1; /** Needed for mobile viewing 'Desktop site' */
  background-color: rgba(0, 0, 0, 0.7);
  font-size: 0.75rem;
  border: 1px solid #555;
  border-width: 1px 1px 1px 1px;
  color: white;

  display: flex;
  flex-direction: column;

  .icon {
    cursor: pointer;
    width: 100%;
    text-align: center;
    padding: 12px;
    transform: scale(1.2);
  }

  .lowercase {
    color: #999;
    &.enabled {
      color: white;
    }
  }
`;
