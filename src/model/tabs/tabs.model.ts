import type { IJsonModel } from 'flexlayout-react';
import type { ComponentFilepathKey } from './lookup';
import { deepClone } from 'projects/service/generic';

export function getTabName(meta: TabMeta) {
  return meta.filepath;
}

export function getTabsId(articleKey: string, tabsName: string) {
  return `${articleKey}--tabs--${tabsName}`;
}

export type TabMeta = { weight?: number; } & (
  | { type: 'component'; filepath: ComponentFilepathKey; }
  | { type: 'terminal'; /** Session identifier */ filepath: string; env?: Record<string, any>; }
);

export function computeJsonModel(
  tabs: TabMeta[][],
  rootOrientationVertical?: boolean,
): IJsonModel {
  return {
    global: {
      tabEnableRename: false,
      rootOrientationVertical,
      tabEnableClose: false,
    },
    layout: {
      type: 'row',
      /**
       * One row for each list in `tabs`.
       */
      children: tabs.map((metas) => ({
        type: 'row',
        weight: metas[0]?.weight,
        /**
         * One tabset for each list in `tabs`
         */
        children: [{
          type: 'tabset',
          /**
           * One tab for each meta in `metas`
           */
          children: metas.map(meta => ({
            type: 'tab',
            /**
             * Tabs must not be duplicated within same `Tabs`,
             * for otherwise this internal `id` will conflict.
             */
            id: getTabName(meta),
            name: getTabName(meta),
            config: deepClone(meta),
          })),
        }],
      })),
    }
  };
}
