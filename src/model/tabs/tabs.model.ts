import type { IJsonModel } from 'flexlayout-react';
import type { CodeFilepathKey, ComponentFilepathKey } from './lookup';
import { deepClone, testNever } from 'projects/service/generic';

/**
 * Internal tab uid used by npm module `flexlayout-react`,
 * and also as portal keys.
 */
export function getTabInternalId(meta: TabMeta) {
  return `${getTabName(meta)}${meta.idSuffix || ''}`;
}

export function getTabName(meta: TabMeta) {
  switch (meta.type) {
    case 'code':
    case 'component':
      return meta.filepath;
    case 'terminal':
      return `@${meta.filepath}`;
    default:
      throw testNever(meta);
  }
}

export function getTabsId(articleKey: string, tabsName: string) {
  return `${articleKey}--tabs--${tabsName}`;
}

export type TabMeta = { idSuffix?: string; weight?: number; } & (
  | { type: 'code'; filepath: CodeFilepathKey; folds?: CodeMirror.Position[] }
  | { type: 'component'; filepath: ComponentFilepathKey; }
  | { type: 'terminal'; /** Session identifier */ filepath: string; env?: Record<string, any>; }
);

export function computeJsonModel(tabs: TabMeta[][]): IJsonModel {
  return {
    global: {
      tabEnableRename: false,
      rootOrientationVertical: true,
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
            id: getTabInternalId(meta),
            name: getTabName(meta),
            config: deepClone(meta),
            // component: meta.key === 'terminal' ? 'terminal' : meta.filepath,
          })),
        }],
      })),
    }
  };
}
