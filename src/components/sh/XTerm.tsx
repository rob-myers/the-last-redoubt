import React from 'react';
import { css, cx } from '@emotion/css';
import { withSize } from 'react-sizeme';

import { Terminal, ITerminalOptions } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { ExtraHandlerContext, LinkProvider } from './xterm-link-provider';
import useStateRef from 'projects/hooks/use-state-ref';

export default withSize({ monitorHeight: true, monitorWidth: true })(
  function XTermComponent(props: Props) {

    const state = useStateRef(() => ({
      container: {} as HTMLDivElement,
      fitAddon: new FitAddon,
      resize() {
        try { state.fitAddon.fit(); }
        catch { /** Saw error: This API only accepts integers */ }
      },
      xterm: {} as Terminal,
    }));

    React.useEffect(() => {
      const xterm = state.xterm = new Terminal(props.options);
      xterm.loadAddon(state.fitAddon);
      window.addEventListener('resize', state.resize);

      props.linkProviderDef &&
        xterm.registerLinkProvider(new LinkProvider(
          xterm,
          props.linkProviderDef.regex,
          props.linkProviderDef.callback,
        ));
      
      xterm.open(state.container);
      state.resize();
      const cleanups = props.onMount(xterm);
      // xterm.focus();

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
  /** Returns cleanups */
  onMount: (xterm: Terminal) => (() => void)[];
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
