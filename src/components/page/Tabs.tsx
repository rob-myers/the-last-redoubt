import React from 'react';
import { css, cx } from '@emotion/css';
import { enableBodyScroll, disableBodyScroll } from 'body-scroll-lock';
import debounce from 'debounce';

import { TabMeta } from 'model/tabs/tabs.model';
import useSiteStore from 'store/site.store';
import { tryLocalStorageGet, tryLocalStorageSet } from 'projects/service/generic';
import { cssName, zIndex } from 'projects/service/const';
import useUpdate from 'projects/hooks/use-update';
import useStateRef from 'projects/hooks/use-state-ref';
import { useIntersection } from 'projects/hooks/use-intersection';
import { Layout } from 'components/dynamic';
import { TabsControls, FaderOverlay } from './TabsControls';
import { createKeyedComponent } from './Tab';

/**
 * Possibly only imported from MDX (which lacks intellisense).
 */
export default function Tabs(props: Props) {
  const update = useUpdate();
  const expandedStorageKey = `expanded@tab-${props.id}`;

  const state = useStateRef((): State => ({
    colour: 'black',
    enabled: !!props.initEnabled,
    everEnabled: !!props.initEnabled,
    expanded: false,

    resets: 0,
    justResetWhileDisabled: false,
    resetDisabled: false,

    el: {
      root: null,
      content: {} as HTMLDivElement,
      backdrop: {} as HTMLDivElement,
    },

    onChangeIntersect: debounce(async (intersects: boolean) =>
      (!intersects && state.enabled && !state.expanded) && await state.toggleEnabled()
    , 1000),

    async onKeyUp(e: React.KeyboardEvent) {
      switch (e.key) {
        case 'Escape':
          if (state.expanded) {
            await state.toggleExpand();
          } else if (state.enabled) {
            await state.toggleEnabled();
          }
          break;
        case 'Enter':
          if (!state.expanded) {
            await state.toggleExpand();
          }
          if (!state.enabled) {
            await state.toggleEnabled();
          }
          break;
      }
    },
    /** Prevent any underlying element from being clicked on click outside modal */
    async onModalBgPress(e: TouchEvent | MouseEvent) {
      e.preventDefault();
      await state.toggleExpand();
    },
    /** Prevent background moving when tab dragged */
    preventTabTouch(e: TouchEvent) {
      if ((e.target as HTMLElement).classList.contains('flexlayout__tab_button_content')) {
        e.preventDefault();
      }
    },

    reset() {
      state.resetDisabled = true;
      const tabs = useSiteStore.getState().tabs[props.id];
      const componentKeys = tabs.getTabNodes().map(node => node.getId());
      useSiteStore.api.removeComponents(tabs.key, ...componentKeys);
      state.justResetWhileDisabled = !state.enabled;
      state.resets++; // Remount
      update();
      setTimeout(() => { state.resetDisabled = false; update(); }, 500);
    },

    async toggleEnabled() {
      state.colour = state.colour === 'clear' ? 'faded' : 'clear';
      state.enabled = !state.enabled;
      update();

      if (state.enabled && !state.everEnabled) {
        state.everEnabled = true;
        setTimeout(state.toggleIndividualTabs, 300);
      } else {
        await state.toggleIndividualTabs();
      }
    },

    async toggleExpand() {
      state.expanded = !state.expanded;
      if (state.expanded) {
        tryLocalStorageSet(expandedStorageKey, 'true');
        if (!state.enabled) {// Auto-enable on expand
          await state.toggleEnabled();
        }
      } else {
        localStorage.removeItem(expandedStorageKey);
      }
      update();
    },

    async toggleIndividualTabs() {
      const tabs = useSiteStore.getState().tabs[props.id];

      if (!tabs) {
        return console.warn(`Tabs not found with id "${props.id}".`);
      }

      const disabled = !state.enabled;
      // Other tab portals may not exist yet, so record in `tabs` too
      tabs.disabled = disabled;
      useSiteStore.setState({}, undefined, disabled ? 'disable-tabs' : 'enable-tabs');

      if (state.justResetWhileDisabled === false) {
        /**
         * Standard case
         * > Set `disabled` for each mounted `Portal` within this `Tabs`.
         */
        const lookup = useSiteStore.getState().component;
        const componentKeys = tabs.getTabNodes().map(node => node.getId());
        componentKeys.forEach(componentKey => componentKey in lookup &&
          useSiteStore.api.setTabDisabled(tabs.key, componentKey, disabled)
        );
      } else {
        /**
         * Special case
         * > Having previously reset Tabs while disabled, we now enable.
         */
        state.justResetWhileDisabled = false;

        await Promise.all(tabs.getVisibleTabNodes().map(async (tabNode) => {
          if (!useSiteStore.getState().component[tabNode.getId()]) {
            await createKeyedComponent(tabs.key, tabNode.getConfig(), false);
          }
          setTimeout(() => // Needed to awaken portal
            useSiteStore.api.setTabDisabled(tabs.key, tabNode.getId(), false),
            300,
          );
        }))
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
      setTimeout(() => disableBodyScroll(state.el.content));
      // To prevent touch event default, it seems we cannot use React events
      ((['touchstart', 'mousedown']) as const).forEach(evt =>
        state.el.backdrop.addEventListener?.(evt, state.onModalBgPress)
      );
      return () => ((['touchstart', 'mousedown']) as const).forEach(evt =>
        state.el.backdrop.removeEventListener?.(evt, state.onModalBgPress)
      );
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
        {state.everEnabled && state.colour !== 'black' && (
          <Layout
            id={props.id}
            /**
             * On reset with state.enabled,
             * we should not initially disable layout.
             */
            initEnabled={state.enabled}
            persistLayout={props.persistLayout}
            /**
             * Horizontal splitter corresponds to
             * rootOrientationVertical being `true`.
             */
            rootOrientationVertical={!!props.initHorizontal}
            tabs={props.tabs}
            update={update}
          />
        )}
        <TabsControls
          api={state}
          tabsId={props.id}
        />
        <FaderOverlay
          colour={state.colour}
        />
      </div>
    </figure>
  );
}

export interface Props {
  /** Required e.g. as identifier */
  id: string;
  /** List of rows each with a single tabset */
  tabs: TabMeta[][];
  height: number | number[];

  /** Initially enabled? */
  initEnabled?: boolean;
  /** Does the _initial Tabs layout_ have a horizontal splitter? */
  initHorizontal?: boolean;
  persistLayout?: boolean;
}

export interface State {
  /** Initially `'black'`, afterwards always in `['faded', 'clear']` */
  colour: 'black' | 'faded' | 'clear';
  enabled: boolean;
  everEnabled: boolean;
  expanded: boolean;

  /** Number of times we have reset */
  resets: number;
  /**
   * Did we just reset whilst Tabs disabled?
   * If so, we'll need to reawaken all visible tabs.
   */
  justResetWhileDisabled: boolean;
  /** Is the reset button disabled? */
  resetDisabled: boolean;

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
  toggleEnabled(): Promise<void>;
  toggleExpand(): Promise<void>;
  toggleIndividualTabs(): Promise<void>;
}


const rootCss = css`
  margin: 32px 0 0 0;

  position: relative;
  > span.anchor {
    position: absolute;
    top: -96px;
  }

  .modal-backdrop {
    position: fixed;
    z-index: ${zIndex.tabsExpandedBackdrop};
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
    border: 1px solid white;
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
  z-index: ${zIndex.tabsExpanded};
  top: 80px;
  left: 256px;
  width: calc(100% - 256px);
  height: calc(100% - 80px);
  border: var(--tabs-border-width) solid #444;

  @media(max-width: 1240px) {
    left: 0;
    top: 80px;
    width: 100%;
    height: calc(100% - 80px);
   }
`;
