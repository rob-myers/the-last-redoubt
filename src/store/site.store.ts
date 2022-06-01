import create from 'zustand';
import { devtools } from 'zustand/middleware';
import type { HtmlPortalNode } from 'react-reverse-portal';
import type { TabNode } from 'flexlayout-react';

import { KeyedLookup } from 'model/generic.model';
import type { TabMeta } from 'model/tabs/tabs.model';
import type { ArticleKey } from 'articles/index';

export type State = {
  /** Key of currently viewed article */
  articleKey: null | ArticleKey;
  articlesMeta: {
    [articleKey: string]: FrontMatter
  };
  navOpen: boolean;
  /** Site-wide portals, corresponding to individual tabs */
  portal: KeyedLookup<PortalState>;
  /** <Tabs> on current page */
  tabs: KeyedLookup<TabsState>;
  api: {

  };
};

const useStore = create<State>(devtools((set, get) => ({
  articleKey: null,
  articlesMeta: {

  },
  navOpen: false,
  portal: {},
  tabs: {},
  api: {

  },
}), 'site'));

export interface FrontMatter {
  key: string;
  path: string;
  info: string;
  date: string;
  prev: null | string;
  next: null | string;
  tags: string[];
}

export interface AllFrontmatter {
  allMdx: {
    edges: {
      node: {
        /** Values are technically possibly null */
        frontmatter: {
          key: string;
          date: string;
          tags: string[];
        };
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
  /** e.g. `/part/1` */
  pagePathname: string;
  selectTab: (tabId: string) => void;
  scrollTo: () => void;
  getTabNodes: () => TabNode[];
}

const api = useStore.getState().api;
const useSiteStore = Object.assign(useStore, { api });

export default useSiteStore;
