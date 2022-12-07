import { navigate } from "gatsby";
import React from "react";
import { Actions, IJsonModel, Layout as FlexLayout, Model, TabNode } from 'flexlayout-react';
import { useBeforeunload } from 'react-beforeunload';
import debounce from "debounce";

import { tryLocalStorageGet, tryLocalStorageSet } from 'projects/service/generic';
import { TabMeta, computeJsonModel, getTabIdentifier } from 'model/tabs/tabs.model';
import { scrollFinished } from 'model/dom.model';
import useSiteStore, { State } from 'store/site.store';
import type { Props as TabsProps } from './Tabs';
import Tab, { createKeyedComponent } from './Tab';

export default function Layout(props: Props) {

  const model = React.useMemo(() => {
    
    const output = restoreJsonModel(props);

    output.visitNodes((node) => {
      if (node.getType() === 'tab') {
        
        // Enable and disable tabs relative to conditions
        node.setEventListener('visibility', async ({ visible }) => {
          if (model.getMaximizedTabset()) {
            return; // If some tab maximised don't enable "visible" tabs covered by it
          }

          const [key, tabMeta] = [node.getId(), (node as TabNode).getConfig() as TabMeta];
          const tabs = useSiteStore.getState().tabs[props.id];

          if (!visible) {// tab now hidden
            if (tabMeta.type === 'component') {// Don't disable hidden terminals
              useSiteStore.api.setTabDisabled(tabs.key, key, true);
            }
          } else {// tab now visible
            if (tabMeta.type === 'terminal') {
              // Ensure scrollbar appears if exceeded scroll area when hidden
              const { default: useSessionStore } = await import("projects/sh/session.store");
              const session = useSessionStore.api.getSession(getTabIdentifier(tabMeta));
              session?.ttyShell.xterm.forceResize();
            }

            window.setTimeout(async () => {
              if (!useSiteStore.getState().component[key]) {
                await createKeyedComponent(tabs.key, tabMeta);
              }
              useSiteStore.api.setTabDisabled(tabs.key, key, tabs.disabled);
            }, 300); // Delay needed for component registration?
          }
        });
      }
    });

    return output;
  }, [JSON.stringify(props.tabs)]);

  useRegisterTabs(props, model);

  /**
   * If some tab is initially maximised, we don't want to render any other tabs.
   * However, `flexlayout-react` renders those tabs which'll be visible on minimize.
   * We prevent these initial renders by not mounting these tabs initially.
   */
  const maxTabNode = (model.getMaximizedTabset()?.getSelectedNode()??null) as TabNode | null; 
  const factoryDeps = { maxTabNode, componentLookup: useSiteStore.getState().component, tabsKey: props.id };

  return (
    <FlexLayout
      model={model}
      factory={node => factory(node, factoryDeps)}
      realtimeResize
      onModelChange={debounce(() => storeModelAsJson(props.id, model), 300)}
      onAction={act => {
        if (act.type === Actions.MAXIMIZE_TOGGLE && maxTabNode) {
          props.update(); // We are minimizing a maximized tab
        }
        return act;
      }}
    />
  );
}

interface Props extends Pick<TabsProps, (
  | 'id'
  | 'tabs'
  | 'initEnabled'
  | 'persistLayout'
)> {
  rootOrientationVertical?: boolean;
  update(): void;
}

/**
 * Register Tabs (collectively, not individual tabs) with redux
 * e.g. so can select a particular tab programmatically.
 */
function useRegisterTabs(props: Props, model: Model) {
  React.useEffect(() => {
    const { tabs } = useSiteStore.getState();
    if (!props.id) {
      return console.warn('Tabs has no id', props.tabs);
    }

    // Register tabs with state
    if (!tabs[props.id]) {
      tabs[props.id] = {
        key: props.id,
        def: props.tabs.flatMap(x => x),
        selectTab(tabId: string) {
          model.doAction(Actions.selectTab(tabId));
        },
        async scrollTo() {
          const id = props.id;
          const { top } = document.getElementById(id)!.getBoundingClientRect();
          window.scrollBy({ top, behavior: 'smooth' });
          if (! await scrollFinished(window.pageYOffset + top)) return;
          navigate(`#${id}`);
        },
        getTabNodes() {
          const output = [] as TabNode[];
          model.visitNodes(x => x instanceof TabNode && output.push(x));
          return output;
        },
        getVisibleTabNodes() {
          const maxTabset = model.getMaximizedTabset();
          return maxTabset ? [maxTabset.getSelectedNode() as TabNode] : this.getTabNodes().filter(x => x.isVisible());
        },
        disabled: !props.initEnabled,
        pagePathname: location.pathname,
      };
      useSiteStore.setState({}, undefined, 'create-tabs');
    }

    return () => {
      // Remove non-portal components
      const { tabs: tabsLookup, component } = useSiteStore.getState();
      const tabs = tabsLookup[props.id];
      const nonPortalKeys = tabs.getTabNodes().map(x => x.getId()).filter(
        key => component[key]?.portal === null
      );
      useSiteStore.api.removeComponents(tabs.key, ...nonPortalKeys);
      // Remove tabs
      delete tabsLookup[props.id];
    };
  }, [model]);

  useBeforeunload(() => storeModelAsJson(props.id, model));

}

/**
 * This function defines the contents of a Tab, triggered whenever it becomes visible.
 * But according to flexlayout-react, a selected tab is "visible" when obscured by a maximised tab.
 * To fix this, if some tab is maximised, we only render siblings of the maximised tab,
 * and also those tabs that have previously been rendered.
 */
function factory(
  node: TabNode,
  deps: {
    maxTabNode: TabNode | null,
    componentLookup: State['component'],
    tabsKey: string,
  },
) {
  if (
    deps.maxTabNode
    && node.getParent() !== deps.maxTabNode.getParent()
    && !deps.componentLookup[node.getId()]
  ) {
    return null;
  }

  return (
    <Tab
      tabsKey={deps.tabsKey}
      {...node.getConfig() as TabMeta}
    />
  );

}

function restoreJsonModel(props: Props) {
  const jsonModelString = tryLocalStorageGet(`model@${props.id}`);

  if (props.persistLayout && jsonModelString) {
    try {
      const serializable = JSON.parse(jsonModelString) as IJsonModel;

      // Larger splitter hit test area
      serializable.global = serializable.global || {};
      serializable.global.splitterExtra = 12;
      // jsonModel.global.splitterSize = 12;

      const model = Model.fromJson(serializable);

      /**
       * Overwrite persisted `TabMeta`s with their value from `props`.
       */
      const tabKeyToMeta = props.tabs.flatMap(x => x).reduce(
        (agg, item) => Object.assign(agg, { [getTabIdentifier(item)]: item }), 
        {} as Record<string, TabMeta>,
      );
      model.visitNodes(x => x.getType() === 'tab' &&
        Object.assign((x as TabNode).getConfig(), tabKeyToMeta[x.getId()])
      );
      
      // Validate i.e. props.tabs must mention same ids
      const prevTabNodeIds = [] as string[];
      model.visitNodes(node => node.getType() === 'tab' && prevTabNodeIds.push(node.getId()));
      const nextTabNodeIds = props.tabs.flatMap(x => x.map(getTabIdentifier));
      if (prevTabNodeIds.length === nextTabNodeIds.length && prevTabNodeIds.every(id => nextTabNodeIds.includes(id))) {
        return model;
      }

      console.error(`restoreJsonModel: prev/next ids differ ${JSON.stringify(prevTabNodeIds)} versus ${JSON.stringify(nextTabNodeIds)}`);
    } catch (e) {
      console.error(e);
    }
  }

  return Model.fromJson(computeJsonModel(
    props.tabs,
    props.rootOrientationVertical,
  ));
}

function storeModelAsJson(id: string, model: Model) {
  const serializable = model.toJson();
  tryLocalStorageSet(`model@${id}`, JSON.stringify(serializable));
}
