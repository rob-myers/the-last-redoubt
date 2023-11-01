import type { IJsonModel } from 'flexlayout-react';
import type { ComponentClassKey } from './lookup';
import { deepClone } from 'projects/service/generic';

/**
 * - name of tab
 * - id of tab
 * - `componentKey`
 * - `sessionKey` when `meta.type === 'terminal'`
 */
export function getTabIdentifier(meta: TabMeta) {
  return meta.filepath;
}

export function getTabsId(articleKey: string, tabsName: string) {
  return `${articleKey}--tabs--${tabsName}`;
}

export type TabMeta = { weight?: number; } & (
  | ({ type: 'component'; filepath: string; class: ComponentClassKey } & TabMetaComponentProps)
  | { type: 'terminal'; /** Session identifier */ filepath: string; env?: Record<string, any>; }
);

type TabMetaComponentProps = (
  | { class: 'GeomorphEdit'; props: import('projects/geomorph/GeomorphEdit').Props; }
  | { class: 'SvgStringPull'; props: import('projects/example/SvgStringPull').Props; }
  | { class: 'SvgNavGraph'; props: import('projects/example/SvgNavGraph').Props; }
  | { class: 'World'; props: import('projects/world/World').Props; }
  | { class: 'WorldGl'; props: import('projects/world-r3f/WorldGl').Props; }
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
      /**
       * Use `visibility: hidden` instead of `display: none`,
       * so we can e.g. getBoundingClientRect() for npc getPosition.
       */
      enableUseVisibility: true,
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
            id: getTabIdentifier(meta),
            name: getTabIdentifier(meta),
            config: deepClone(meta),
          })),
        }],
      })),
    }
  };
}
