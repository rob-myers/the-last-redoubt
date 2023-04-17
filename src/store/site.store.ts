import create from 'zustand';
import { devtools } from 'zustand/middleware';
import type { HtmlPortalNode } from 'react-reverse-portal';
import type { TabNode } from 'flexlayout-react';

import type { TabMeta } from 'model/tabs/tabs.model';
import { KeyedLookup, tryLocalStorageSet } from 'projects/service/generic';
import { cssName, cssTimeMs, localStorageKey } from 'projects/service/const';

export type State = {
  /** Key of currently viewed article */
  articleKey: null | string;
  /** Frontmatter of every article */
  articlesMeta: { [articleKey: string]: FrontMatter };
  discussMeta: { [articleKey: string]: GiscusDiscussionMeta };
  groupedMetas: FrontMatter[][];
  
  darkMode: boolean;
  browserLoad: boolean;
  navOpen: boolean;
  /**
   * Components occurring in Tabs.
   * Some have portals, so they persist when pages change.
   */
  component: KeyedLookup<KeyedComponent>;
  /** <Tabs> on current page */
  tabs: KeyedLookup<TabsState>;

  api: {
    clickToClipboard(e: React.MouseEvent): Promise<void>;
    initiate(allFm: AllFrontMatter): void;
    initiateBrowser(): void;
    removeComponents(tabsKey: string, ...componentKeys: string[]): void;
    setArticleKey(articleKey?: string): void
    setTabDisabled(tabsKey: string, componentKey: string, disabled: boolean): void
    toggleDarkMode(): void;
  };
};

const useStore = create<State>()(devtools((set, get) => ({
  articleKey: null,
  articlesMeta: {},
  discussMeta: {},
  groupedMetas: [],

  navOpen: false,
  browserLoad: false,
  darkMode: false,
  component: {},
  tabs: {},

  api: {
    async clickToClipboard(e) {
      const el = e.target as HTMLElement;
      const { textContent } = el;
      if (textContent) {
        try {
          await navigator.clipboard.writeText(textContent);
          el.classList.add(cssName.justCopied);
          window.setTimeout(() => el.classList.remove(cssName.justCopied), cssTimeMs.justCopied);
        } catch (e) {
          console.error(`Failed to copy text to clipboard: "${textContent}" (${e})`);
          el.classList.add(cssName.copyJustFailed);
          window.setTimeout(() => el.classList.remove(cssName.copyJustFailed), cssTimeMs.justCopied);
        }
      }
    },

    initiate({ allMdx: { edges } }) {
      const articlesMeta = {} as State['articlesMeta'];
      for (const { node: { frontmatter: fm } } of edges) {
        if (fm && fm.key) {
          articlesMeta[fm.key] = { ...fm, tags: [...(fm.tags || [])] };
        }
      }
      const groupedMetas = Object.values(articlesMeta).reduce((agg, item) => {
        item.navGroup !== null && (agg[item.navGroup] = agg[item.navGroup] || []).push(item);
        return agg;
      }, [] as FrontMatter[][]);
      groupedMetas.forEach(group => group.sort((a, b) =>
        (a.prev === null || b.prev === a.key || a.next === b.key || b.next === null) ? -1 : 1
      ));

      set({
        articlesMeta,
        groupedMetas,
        darkMode: typeof window !== 'undefined' && document.body.classList.contains('dark-mode'),
      }, undefined, 'initiate');
    },

    initiateBrowser() {
      // setTimeout(() => {
      //   document.body.style.scrollBehavior = 'smooth';
      //   document.documentElement.style.scrollBehavior = 'smooth';
      // }, 1000);

      window.addEventListener('message', (message) => {
        if (message.origin === 'https://giscus.app' && message.data.giscus?.discussion) {
          const discussion = message.data.giscus.discussion as GiscusDiscussionMeta;
          console.log('giscus meta', discussion);
          const { articleKey } = get();
          if (articleKey) {
            set(
              ({ discussMeta: comments }) => ({ discussMeta: { ...comments, [articleKey]: discussion } }),
              undefined, 'store-giscus-meta',
            );
            return true;
          }
        }
      });

      set(() => ({ browserLoad: true }), undefined, 'browser-load');
    },

    removeComponents(tabsKey, ...componentKeys) {
      const { component: lookup } = get();
      componentKeys.forEach(portalKey => {
        const component = lookup[portalKey];
        if (!component) {
          return; // Hidden tabs may lack item in `lookup`
        }
        if (component.portal) {
          component.portal.unmount();
          delete lookup[portalKey];
        } else {
          delete component.disabled[tabsKey];
          component.instances--;
          !component.instances && delete lookup[portalKey];
        }
      });
      set({ component: { ...lookup } }, undefined, 'remove-components');
    },

    setArticleKey(articleKey) {
      set({ articleKey: articleKey??null }, undefined, 'set-article-key');
    },

    setTabDisabled(tabsKey, componentKey, disabled) {
      const component = useSiteStore.getState().component[componentKey];
      component.disabled[tabsKey] = disabled;
      component.portal?.setPortalProps({ disabled });
      useSiteStore.setState(({ component: lookup }) => {
        lookup[componentKey] = { ...component }; // ?
        return {};
      }, undefined, disabled ? 'disable-tabs' : 'enable-tabs');
    },

    toggleDarkMode() {
      const enabled = document.body.classList.toggle('dark-mode');
      tryLocalStorageSet(localStorageKey.darkModeEnabled, `${enabled}`);
      set({ darkMode: enabled }, undefined, enabled ? 'enable-dark-mode' : 'disable-dark-mode');
    },
  },
}), { name: "site.store" } ));

export interface FrontMatter {
  key: string;
  date: string;
  icon: string;
  giscusTerm?: string;
  info: string;
  label: string;
  navGroup: null | number;
  next: null | string;
  path: string;
  prev: null | string;
  tags: string[];
}

export interface AllFrontMatter {
  allMdx: {
    edges: {
      node: {
        /** Values are technically possibly null */
        frontmatter: FrontMatter;
      };
    }[];
  };
  allFile: {
    iconFilenames: { node: { relativePath: string; } }[];
  }
}

/**
 * TODO support components without portals.
 */
export interface KeyedComponent {
  key: string;
  /** This is retrieved from lookup.tsx */
  component?: ((props: { disabled?: boolean; }) => JSX.Element);
  /** If `portal` is truthy this must be `1` */
  instances: number;
  /** Original definition provided to `<Tabs/>` */
  meta: TabMeta;
  portal: null | HtmlPortalNode;
  /**
   * Parametric in parent Tabs.
   * If `portal` truthy it will have exactly one key-value pair,
   * although we won't actually use it.
   */
  disabled: {
    [tabsKey: string]: boolean;
  };
}

export interface KeyedPortal extends KeyedComponent {
  portal: HtmlPortalNode;
}

interface TabsState {
  key: string;
  def: TabMeta[];
  disabled: boolean;
  /** e.g. `/objective` */
  pagePathname: string;
  selectTab(tabId: string): void;
  scrollTo(): void;
  getTabNodes(): TabNode[];
  /** The _actually_ visible `TabNodes` e.g. only 1 when a tab maximised */
  getVisibleTabNodes(): TabNode[];
}

interface GiscusDiscussionMeta {
  id: string;
  locked: boolean;
  reactionCount: number;
  reactions: Record<(
    | 'CONFUSED'
    | 'EYES'
    | 'HEART'
    | 'HOORAY'
    | 'LAUGH'
    | 'ROCKET'
    | 'THUMBS_DOWN'
    | 'THUMBS_UP'
  ), { count: number; viewerHasReacted: boolean; }>;
  repository: { nameWithOwner: string; }
  totalCommentCount: number;
  totalReplyCount: number;
  /** e.g. `"https://github.com/rob-myers/the-last-redoubt/discussions/5"` */
  url: string;
}

const api = useStore.getState().api;
const useSiteStore = Object.assign(useStore, { api });

export default useSiteStore;
