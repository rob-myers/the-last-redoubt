import React from 'react';
import { css, cx } from '@emotion/css';
import { enableBodyScroll, disableBodyScroll } from 'body-scroll-lock';
import debounce from 'debounce';

import { getTabName, TabMeta } from 'model/tabs/tabs.model';
import useSiteStore from 'store/site.store';
import { tryLocalStorageGet, tryLocalStorageSet } from 'projects/service/generic';
import { cssName } from 'projects/service/const';
import useUpdate from 'projects/hooks/use-update';
import useStateRef from 'projects/hooks/use-state-ref';
import { useIntersection } from 'projects/hooks/use-intersection';
import { Layout } from 'components/dynamic';
import { TabsOverlay, LoadingOverlay } from './TabsOverlay';
import { createKeyedComponent } from './Tab';

/**
 * Possibly only imported from MDX,
 * which lacks intellisense.
 */
export default function Tabs(props: Props) {
  const update = useUpdate();
  const expandedStorageKey = `expanded@tab-${props.id}`;

  const state = useStateRef((): State => ({
    colour: 'black',
    enabled: !!props.initEnabled,
    expanded: false,
    resets: 0,
    justResetWhileDisabled: false,

    el: {
      root: null,
      content: {} as HTMLDivElement,
      backdrop: {} as HTMLDivElement,
    },

    onChangeIntersect: debounce((intersects: boolean) => {
      !intersects && state.enabled && state.toggleEnabled();
    }, 1000),

    onKeyUp(e: React.KeyboardEvent) {
      if (state.expanded && e.key === 'Escape') {
        state.toggleExpand();
      }
    },
    /** Prevent any underlying element from being clicked on click outside modal */
    onModalBgPress(e: TouchEvent | MouseEvent) {
      e.preventDefault();
      state.toggleExpand();
    },
    /** Prevent background moving when tab dragged */
    preventTabTouch(e: TouchEvent) {
      if ((e.target as HTMLElement).classList.contains('flexlayout__tab_button_content')) {
        e.preventDefault();
      }
    },

    reset() {
      const tabs = useSiteStore.getState().tabs[props.id];
      const componentKeys = tabs.getTabNodes().map(node => node.getId());
      useSiteStore.api.removeComponents(...componentKeys);

      if (state.enabled) {
        state.resets++;
        update();
      }
      state.justResetWhileDisabled = !state.enabled;
    },
    toggleEnabled() {
      state.colour = state.colour === 'clear' ? 'faded' : 'clear';
      state.enabled = !state.enabled;
      const tabs = useSiteStore.getState().tabs[props.id];

      if (tabs) {
        const disabled = !state.enabled;
        const lookup = useSiteStore.getState().component;

        if (state.justResetWhileDisabled === false) {
          /**
           * Standard case
           * > Set `disabled` for each mounted `Portal` within this `Tabs`.
           */
          const componentKeys = tabs.getTabNodes().map(node => node.getId());
          componentKeys.forEach(componentKey => componentKey in lookup &&
            useSiteStore.api.setTabDisabled(tabs.key, componentKey, disabled)
          );
        } else {
          // TODO why does previously opened tab fail to load post-reset?

          /**
           * Special case
           * > Having previously reset Tabs while disabled, we now enable.
           */
          const visibleTabNodes = tabs.getVisibleTabNodes();
          visibleTabNodes.forEach(tabNode => !lookup[tabNode.getId()]
            && createKeyedComponent(tabs.key, tabNode.getConfig())
          );
          setTimeout(() => {
            visibleTabNodes.forEach((tabNode) => {
              useSiteStore.api.setTabDisabled(tabs.key, tabNode.getId(), false);
            });
          }, 300);
          state.justResetWhileDisabled = false;
        }
        
        // Other tab portals may not exist yet, so record in `tabs` too
        tabs.disabled = disabled;
        useSiteStore.setState({});
      } else {
        console.warn(
          `Tabs not found for id "${props.id}". ` +
          `Expected Markdown syntax <div class="tabs" name="my-identifier" ...>`
        );
      }

      update();
    },
    toggleExpand() {
      state.expanded = !state.expanded;
      if (state.expanded) {
        tryLocalStorageSet(expandedStorageKey, 'true');
        if (!state.enabled) {// Auto-enable on expand
          state.toggleEnabled();
        }
      } else {
        localStorage.removeItem(expandedStorageKey);
      }
      update();
    },

  }));

  useIntersection({
    elRef: () => state.el.root,
    cb: state.onChangeIntersect,
  });

  React.useEffect(() => {
    // Initially trigger CSS animation
    state.colour = state.enabled ? 'clear' : 'faded';

    state.el.root?.addEventListener('touchstart', state.preventTabTouch, { passive: false });

    if (tryLocalStorageGet(expandedStorageKey) === 'true') {
      if (!useSiteStore.getState().navOpen) {
        state.expanded = true;
        location.href = `#${props.id}`;
      } else {// Ignore maximise if menu open (just navigated to page)
        localStorage.removeItem(expandedStorageKey);
      }
    }
    update();

    return () => {
      state.el.root?.removeEventListener('touchstart', state.preventTabTouch);
    };
  }, []);

  React.useEffect(() => {
    if (state.expanded) {
      disableBodyScroll(state.el.content);
      // To prevent touch event default, seems cannot use React events
      ((['touchstart', 'mousedown']) as const).forEach(evt =>
        state.el.backdrop.addEventListener?.(evt, state.onModalBgPress)
      );
      // return () => ((['touchstart', 'mousedown']) as const).forEach(evt =>
      //   state.el.backdrop.removeEventListener?.(evt, state.onModalBgPress)
      // );
    } else {
      enableBodyScroll(state.el.content);
    }
  }, [state.expanded, state.el.backdrop]);

  return (
    <figure
      key={`${props.id}-${state.resets}`}
      ref={el => state.el.root = el}
      className={cx(cssName.tabs, "scrollable", rootCss)}
      onKeyUp={state.onKeyUp}
      tabIndex={0}
    >
      <span id={props.id} className="anchor" />

      {state.expanded && <>
        <div
          ref={el => el && (state.el.backdrop = el)}
          className="modal-backdrop"
        />
        <div className={fillInlineSpaceCss(props.height)} />
      </>}

      <div
        ref={el => el && (state.el.content = el)}
        className={cx(
          cssName.expanded,
          state.expanded ? expandedCss : unexpandedCss(props.height),
        )}
      >
        {state.colour !== 'black' && (
          <Layout
            id={props.id}
            initEnabled={!!props.initEnabled || state.resets > 0}
            tabs={props.tabs}
            update={update}
          />
        )}
        <TabsOverlay api={state} tabsId={props.id} />
        <LoadingOverlay colour={state.colour} />
      </div>
    </figure>
  );
}

export interface Props {
  /** Required */
  id: string;
  /** List of rows each with a single tabset */
  tabs: TabMeta[][];
  initEnabled?: boolean;
  height: number | number[];
}

export interface State {
  /** Initially `'black'`, afterwards always in `['faded', 'clear']` */
  colour: 'black' | 'faded' | 'clear';
  enabled: boolean;
  expanded: boolean;
  resets: number;
  justResetWhileDisabled: boolean;

  el: {
    /** Align to `useIntersection` hook; avoid HTMLElement in SSR  */
    root: HTMLElement | null;
    content: HTMLDivElement;
    backdrop: HTMLDivElement;
  };

  onChangeIntersect(intersects: boolean): void;
  onKeyUp(e: React.KeyboardEvent): void;
  onModalBgPress(e: TouchEvent | MouseEvent): void;
  preventTabTouch(e: TouchEvent): void;

  reset(): void;
  toggleEnabled(): void;
  toggleExpand(): void;
}


const rootCss = css`
  margin: 64px 0;
  @media(max-width: 600px) {
    margin: 48px 0 32px 0;
  }

  position: relative;
  > span.anchor {
    position: absolute;
    top: -96px;
  }

  .modal-backdrop {
    position: fixed;
    z-index: 19;
    left: 0;
    top: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
  }

  .flexlayout__tab {
    background-color: black;
    border-top: 3px solid #444;
    overflow: hidden;

    /** react-reverse-portal wraps things in a div  */
    > div.portal {
      width: 100%;
      height: inherit;
    }
  }
  .flexlayout__tabset_tabbar_outer {
    background: #222;
    border-bottom: 1px solid #555;
  }
  .flexlayout__tab_button--selected, .flexlayout__tab_button:hover {
    background: #444;
  }
  .flexlayout__tab_button_content {
    user-select: none;
    font-size: 0.7rem;
    font-family: sans-serif;
    font-weight: 300;
    color: #aaa;
  }
  .flexlayout__tab_button--selected .flexlayout__tab_button_content {
    color: #fff;
  }
  .flexlayout__tab_button:hover:not(.flexlayout__tab_button--selected) .flexlayout__tab_button_content {
    color: #ddd;
  }
  .flexlayout__splitter_vert, .flexlayout__splitter_horz {
    background: #827575;
  }
  .flexlayout__tab_toolbar_button {
    cursor: pointer;
  }
  .flexlayout__tab_toolbar_button-max svg {
    outline: 1px solid white;
    path:nth-child(2) {
      fill: white;
    }
  }
  .flexlayout__tab_toolbar_button-max:hover {
    path:nth-child(2) {
      fill: black;
    }
  }
`;

const unexpandedCss = (height: number | number[]) => css`
  width: 100%;
  height: ${Array.isArray(height) ? height[1] : height}px;
  position: relative;
  border: var(--tabs-border-width) solid #444;
  
  @media(max-width: 600px) {
    height: ${Array.isArray(height) ? height[0] : height}px;
  }
`;

/** When expanded we need to fill original space */
const fillInlineSpaceCss = (height: number | number[]) => css`
  height: ${Array.isArray(height) ? height[1] : height}px;
  @media(max-width: 600px) {
    height: ${Array.isArray(height) ? height[0] : height}px;
  }
  background: #fff;
`;

const expandedCss = css`
  ${cssName.tabsExpandedMaxWidth}: 2400px;
  position: fixed;
  z-index: 20;
  top: 80px;
  left: 40px;
  width: calc(100% - 80px);
  height: calc(100% - 80px);
  border: var(--tabs-border-width) solid #444;

  @media(max-width: 800px) {
    left: 0;
    top: 80px;
    width: 100%;
    height: calc(100% - 80px);
   }
`;
