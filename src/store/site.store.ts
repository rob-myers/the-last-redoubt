import create from 'zustand';
import { devtools } from 'zustand/middleware';
import type { HtmlPortalNode } from 'react-reverse-portal';
import type { TabNode } from 'flexlayout-react';

import type { TabMeta } from 'model/tabs/tabs.model';
import type { KeyedLookup } from 'projects/service/generic';

export type State = {
  /** Key of currently viewed article */
  articleKey: null | string;
  /** Frontmatter of every article */
  articlesMeta: { [articleKey: string]: FrontMatter };
  groupedMetas: FrontMatter[][];
  
  navOpen: boolean;
  /**
   * Components occurring in Tabs.
   * Some have portals, so they persist when pages change.
   */
  component: KeyedLookup<KeyedComponent>;
  /** <Tabs> on current page */
  tabs: KeyedLookup<TabsState>;
  api: {
    initiate(allFm: AllFrontMatter, fm: FrontMatter | undefined): void;
    removeComponents(...componentKeys: string[]): void;
  };
};

const useStore = create<State>(devtools((set, get) => ({
  articleKey: null,
  articlesMeta: {},
  groupedMetas: [],
  navOpen: false,
  component: {},
  tabs: {},
  api: {

    initiate({ allMdx: { edges } }, fm) {
      if (get().groupedMetas.length) {
        return set({ articleKey: fm ? fm.key : null });
      }

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
      groupedMetas.forEach(group => group.sort((a, b) => b.prev === a.key ? -1 : 1));

      set({
        articleKey: fm ? fm.key : null,
        articlesMeta,
        groupedMetas,
      });
    },

    removeComponents(...componentKeys) {
      const { component: lookup } = get();
      componentKeys.forEach(portalKey => {
        if (lookup[portalKey]) {
          lookup[portalKey].portal?.unmount();
          delete lookup[portalKey];
        } // Hidden tab portals may not exist
      });
      set({ component: { ...lookup } });
    },
  },
}), { name: "site.store" } ));

export interface FrontMatter {
  key: string;
  path: string;
  info: string;
  label: string;
  date: string;
  navGroup: null | number;
  prev: null | string;
  next: null | string;
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
  setDisabled(next: boolean): void;
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

const api = useStore.getState().api;
const useSiteStore = Object.assign(useStore, { api });

export default useSiteStore;
