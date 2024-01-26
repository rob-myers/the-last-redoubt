import React from 'react';
import { css, cx } from '@emotion/css';
import { withSize } from 'react-sizeme';

import { Terminal, ITerminalOptions } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { ExtraHandlerContext, LinkProvider } from './xterm-link-provider';
import useStateRef from 'projects/hooks/use-state-ref';
import type { ttyXtermClass } from 'projects/sh/tty.xterm';

export default withSize({ monitorHeight: true, monitorWidth: true })(
  function XTermComponent(props: Props) {

    const state = useStateRef(() => ({
      container: {} as HTMLDivElement,
      fitAddon: new FitAddon,
      resize() {},
      xterm: {} as Terminal,
    }));

    React.useEffect(() => {
      const xterm = state.xterm = new Terminal(props.options);

      props.linkProviderDef &&
        xterm.registerLinkProvider(new LinkProvider(
          xterm,
          props.linkProviderDef.regex,
          props.linkProviderDef.callback,
        ));

      const { ttyXterm, cleanups } = props.onMount(xterm);

      state.resize = () => {
        try {
          ttyXterm.nextInteractivePrompt(false);
          state.fitAddon.fit();
        } catch { /** Saw error: This API only accepts integers */ }
      };
      xterm.loadAddon(state.fitAddon);
      window.addEventListener('resize', state.resize);
      state.resize();

      xterm.open(state.container);

      return () => {
        window.removeEventListener('resize', state.resize);
        cleanups.forEach(cleanup => cleanup());
        xterm.dispose();
      };
    }, []);

    React.useEffect(
      () => void state.resize(),
      [props.size?.height, props.size?.width],
    );

    return (
      <div
        ref={x => x && (state.container = x)}
        className={cx("xterm-container", "scrollable", rootCss)}
        onKeyDown={stopKeysPropagating}
      />
    );
  }
);

interface Props {
  linkProviderDef?: {
    regex: RegExp;
    callback(event: MouseEvent, text: string, extraCtxt: ExtraHandlerContext): void;
  };
  options?: ITerminalOptions;
  onMount: (xterm: Terminal) => {
    cleanups: (() => void)[];
    ttyXterm: ttyXtermClass;
  };
  /** @see withSize */
  size: {
    width?: number;
    height?: number;
  };
}

const rootCss = css`
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

function stopKeysPropagating(e: React.KeyboardEvent) {
  e.stopPropagation();
}
