import create from 'zustand';
import { devtools } from 'zustand/middleware';
import type { HtmlPortalNode } from 'react-reverse-portal';
import type { TabNode } from 'flexlayout-react';

import type { TabMeta } from 'model/tabs/tabs.model';

export type State = {
  /** Key of currently viewed article */
  articleKey: null | string;
  /** Frontmatter of every article */
  articlesMeta: { [articleKey: string]: FrontMatter };
  groupedMetas: FrontMatter[][];
  
  navOpen: boolean;
  /** Site-wide portals, corresponding to individual tabs */
  portal: TypeUtil.KeyedLookup<PortalState>;
  /** <Tabs> on current page */
  tabs: TypeUtil.KeyedLookup<TabsState>;
  api: {
    initiate(allFm: AllFrontMatter, fm: FrontMatter | undefined): void;
    removePortals(...portalKeys: string[]): void;
  };
};

const useStore = create<State>(devtools((set, get) => ({
  articleKey: null,
  articlesMeta: {},
  groupedMetas: [],
  navOpen: false,
  portal: {},
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

    removePortals(...portalKeys) {
      const { portal: portalLookup } = get();
      portalKeys.forEach(portalKey => {
        const portal = portalLookup[portalKey];
        if (portal) {
          portal.portal.unmount();
          delete portalLookup[portalKey];
        } // Hidden tab portals may not exist
      });
      set({});
    },
  },
}), 'site'));

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

export interface PortalState {
  key: string;
  meta: TabMeta;
  portal: HtmlPortalNode;
  component?: ((props: { disabled?: boolean; }) => JSX.Element);
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
