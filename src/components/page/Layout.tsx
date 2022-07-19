import { navigate } from "gatsby";
import React from "react";
import { Actions, IJsonModel, Layout as FlexLayout, Model, TabNode } from 'flexlayout-react';
import { useBeforeunload } from 'react-beforeunload';
import debounce from "debounce";

import { tryLocalStorageGet, tryLocalStorageSet } from 'projects/service/generic';
import { TabMeta, computeJsonModel, getTabName } from 'model/tabs/tabs.model';
import { scrollFinished } from 'model/dom.model';
import useSiteStore, { State } from 'store/site.store';
import type { Props as TabsProps } from './Tabs';
import Portal from './Portal';

export default function Layout(props: Props) {

  const model = React.useMemo(() => {
    
    const output = restoreJsonModel(props);

    output.visitNodes((node) => {
      if (node.getType() === 'tab') {
        node.setEventListener('visibility', () => {
          /**
           * - Enable if tab becomes visible and parent Tabs enabled.
           * - Disable 'component' tabs if they become invisible.
           *   We don't disable invisible 'terminal' tabs.
           */
          window.setTimeout(() => {
            const [key, visible] = [node.getId(), node.isVisible()];
            const portal = useSiteStore.getState().portal[key];
            const tabs = Object.values(useSiteStore.getState().tabs)
              .find(x => x.def.some(y => getTabName(y) === portal?.key));
            if (portal && tabs) {
              const disabled = tabs.disabled || (
                !visible && portal.meta.type !== 'terminal'
              );
              portal.portal.setPortalProps({ disabled });
            }
          });
        });
      }
    });

    return output;
  }, [JSON.stringify(props.tabs)]);

  /**
   * If some tab initially maximised, we don't want to render any other tabs.
   * However, `flexlayout-react` renders those tabs which'll be visible on minimize.
   * We prevent these initial renders by not mounting these tabs initially.
   */
  const maximisedTabNode = (model.getMaximizedTabset()?.getSelectedNode()??null) as TabNode | null; 
  const portalLookup = useSiteStore.getState().portal;

  useRegisterTabs(props, model);

  return (
    <FlexLayout
      model={model}
      factory={node => factory(node, maximisedTabNode, portalLookup)}
      realtimeResize
      onModelChange={debounce(() => storeModelAsJson(props.id, model), 300)}
      onAction={act => {
        if (act.type === Actions.MAXIMIZE_TOGGLE && maximisedTabNode) {
          props.update();
        }
        return act;
      }}
    />
  );
}

interface Props extends Pick<TabsProps, 'tabs'> {
  id: string;
  initEnabled: boolean;
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
        def: props.tabs[0].concat(props.tabs[1]),
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
    }
    useSiteStore.setState({});

    return () => void delete useSiteStore.getState().tabs[props.id];
  }, [model]);

  useBeforeunload(() => storeModelAsJson(props.id, model));

}

/**
 * This function defines the contents of a Tab, triggered whenever it becomes visible.
 * But according to flexlayout-react, a selected tab is "visible" when obscured by a maximised tab.
 * To fix this, if some tab is maximised, we only render siblings of the maximised tab,
 * and also those tabs that have previously been rendered.
 */
function factory(node: TabNode, maxTabNode: TabNode | null, portalLookup: State['portal']) {
  if (
    !maxTabNode
    || node.getParent() === maxTabNode.getParent()
    || node.getId() in portalLookup
  ) {
    const meta = node.getConfig() as TabMeta;
    return <Portal {...meta} />;
  } else {
    return null;
  }
}

function restoreJsonModel(props: Props) {
  try {
    const jsonModelString = tryLocalStorageGet(`model@${props.id}`);
    if (jsonModelString) {
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
        (agg, item) => Object.assign(agg, { [getTabName(item)]: item }), 
        {} as Record<string, TabMeta>,
      );
      model.visitNodes(x => x.getType() === 'tab' &&
        Object.assign((x as TabNode).getConfig(), tabKeyToMeta[x.getId()])
      );
      
      // Validate i.e. props.tabs must mention same ids
      const prevTabNodeIds = [] as string[];
      model.visitNodes(node => node.getType() === 'tab' && prevTabNodeIds.push(node.getId()));
      const nextTabNodeIds = props.tabs[0].concat(props.tabs[1]).map(getTabName)
      if (prevTabNodeIds.length === nextTabNodeIds.length && prevTabNodeIds.every(id => nextTabNodeIds.includes(id))) {
        return model;
      }

      console.error(`restoreJsonModel: prev/next ids differ ${JSON.stringify(prevTabNodeIds)} versus ${JSON.stringify(nextTabNodeIds)}`);
    }
  } catch (e) {
    console.error(e);
  }

  return Model.fromJson(computeJsonModel(props.tabs));
}

function storeModelAsJson(id: string, model: Model) {
  const serializable = model.toJson();
  tryLocalStorageSet(`model@${id}`, JSON.stringify(serializable));
}
