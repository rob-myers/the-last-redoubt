import React from 'react';
import { css, cx } from '@emotion/css';
import { tryLocalStorageGet, tryLocalStorageSet } from 'projects/service/generic';
import { zIndex, localStorageKey } from 'projects/service/const';
import type { Session } from 'projects/sh/session.store';
import useStateRef from 'projects/hooks/use-state-ref';
import useUpdate from 'projects/hooks/use-update';

export default function TouchHelperUI(props: {
  session: Session;
  disabled?: boolean;
}) {

  const update = useUpdate();
  const { xterm } = props.session.ttyShell;

  const state = useStateRef(() => {
    return {
      open: true,
      async onClickMenu(e: React.MouseEvent) {
        const target = e.target as HTMLElement;
        xterm.xterm.scrollToBottom();
        if (target.classList.contains('paste')) {
          try {
            const textToPaste = await navigator.clipboard.readText();
            xterm.spliceInput(textToPaste);
          } catch {}
        } else if (target.classList.contains('can-type')) {
          const next = !xterm.canType()
          xterm.setCanType(next);
          tryLocalStorageSet(localStorageKey.touchTtyCanType, `${next}`);
          next && xterm.warnIfNotReady();
          update();
        } else if (target.classList.contains('ctrl-c')) {
          xterm.sendSigKill();
        } else if (target.classList.contains('enter')) {
          xterm.queueCommands([{ key: 'newline' }]);
        } else if (target.classList.contains('delete')) {
          xterm.deletePreviousWord();
        } else if (target.classList.contains('clear')) {
          xterm.clearScreen();
        } else if (target.classList.contains('up')) {
          xterm.reqHistoryLine(+1);
        } else if (target.classList.contains('down')) {
          xterm.reqHistoryLine(-1);
        } 
        // xterm.xterm.focus();
      },
      onClickToggle() {
        const next = !state.open;
        state.open = next;
        tryLocalStorageSet(localStorageKey.touchTtyOpen, `${next}`);
        update();
      },
    };
  });
  
  React.useMemo(() => {
    if (!tryLocalStorageGet(localStorageKey.touchTtyCanType)) {
      // tty disabled on touch devices by default
      tryLocalStorageSet(localStorageKey.touchTtyCanType, 'false');
    }
    if (!tryLocalStorageGet(localStorageKey.touchTtyOpen)) {
      // touch menu closed on touch devices by default
      tryLocalStorageSet(localStorageKey.touchTtyOpen, 'false');
    }
    xterm.setCanType(tryLocalStorageGet(localStorageKey.touchTtyCanType) === 'true');
    state.open = tryLocalStorageGet(localStorageKey.touchTtyOpen) === 'true';
    return () => void (xterm.setCanType(true));
  }, []);

  return (
    <div
      className={cx(menuCss, {
        disabled: props.disabled,
        open: state.open,
      })}
      onClick={state.onClickMenu}
    >
      <div
        className="menu-toggler"
        onClick={state.onClickToggle}
      >
        {state.open ? '>' : '<'}
      </div>
      <div className={cx(
        'icon can-type',
        { enabled: xterm.canType() },
      )}>
        $
      </div>
      <div className="icon paste">
        paste
      </div>
      <div className="icon enter">
        enter
      </div>
      <div className="icon delete">
        del
      </div>
      <div className="icon ctrl-c">
        kill
      </div>
      <div className="icon clear">
        clear
      </div>
      <div className="icon up">
        prev
      </div>
      <div className="icon down">
        next
      </div>
    </div>
  );
}

const menuCss = css`
  --menu-width: 54px;

  position: absolute;
  z-index: ${zIndex.ttyTouchHelper};
  top: 0;
  right: 0;
  width: var(--menu-width);

  display: flex;
  flex-direction: column;

  line-height: 1; /** Needed for mobile viewing 'Desktop site' */
  background-color: rgba(0, 0, 0, 0.7);
  font-size: 0.75rem;
  border: 1px solid #555;
  border-width: 1px 1px 1px 1px;
  color: white;
  
  &.disabled {
    filter: brightness(0.5);
    pointer-events: none;
  }


  transition: transform 500ms;
  &.open {
    transform: translate(0px, 0px);
  }
  &:not(.open) {
    transform: translate(var(--menu-width), 0px);
  }
  
  .menu-toggler {
    position: absolute;
    z-index: ${zIndex.ttyTouchHelper};
    top: 0px;
    right: calc(var(--menu-width) - 1px);
    
    width: 32px;
    height: 32px;
    
    display: flex;
    justify-content: center;
    align-items: center;
    
    font-size: 12px;
    background: rgba(0, 0, 0, 0.5);
    color: #ddd;
    border: 2px solid #444;
  }

  .icon {
    cursor: pointer;
    width: 100%;
    text-align: center;
    padding: 12px;
    transform: scale(1.2);
    color: #cfc;
  }

  .can-type {
    color: #0f0;
    &:not(.enabled) {
      color: #999;
    }
  }
`;
