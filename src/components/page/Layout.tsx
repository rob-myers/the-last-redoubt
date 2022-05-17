import React from 'react';
import { navigate } from '@reach/router';
import { Actions, Layout as FlexLayout, Model, TabNode } from 'flexlayout-react';

import { TabMeta, computeJsonModel } from 'model/tabs/tabs.model';
import { scrollFinished } from 'model/dom.model';
import useSiteStore from 'store/site.store';
import type { Props as TabsProps } from './Tabs';
import Portal from './Portal';

export default function Layout(props: Props) {

  const model = React.useMemo(() => {
    const output = Model.fromJson(computeJsonModel(props.tabs));
    output.visitNodes((node) => {
      if (node.getType() === 'tab') {
        node.setEventListener('visibility', () => {
          /**
           * - Disable if tab becomes invisible.
           * - Enable if tab becomes visible and parent Tabs enabled.
           */
          window.setTimeout(() => {
            const [key, visible] = [node.getId(), node.isVisible()];
            const portal = useSiteStore.getState().portal[key];
            const tabs = Object.values(useSiteStore.getState().tabs)
              .find(x => x.def.some(y => y.filepath === portal?.key));
            if (portal && tabs) {
              // console.log(key, visible, tabs);
              portal.portal.setPortalProps({ disabled: !visible || tabs.disabled });
            }
          });
        });
      }
    });
    return output;
  }, [JSON.stringify(props.tabs)]);

  useRegisterTabs(props, model);

  return (
    <FlexLayout
      model={model}
      factory={factory}
      realtimeResize
    />
  );
}

interface Props extends Pick<TabsProps, 'tabs'> {
  id: string;
  readonly initEnabled: boolean;
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
        selectTab: (tabId: string) =>
          model.doAction(Actions.selectTab(tabId)),
        scrollTo: async () => {
          const id = props.id;
          const { top } = document.getElementById(id)!.getBoundingClientRect();
          window.scrollBy({ top, behavior: 'smooth' });
          if (! await scrollFinished(window.pageYOffset + top)) return;
          navigate(`#${id}`);
        },
        getTabNodes: () => {
          const output = [] as TabNode[];
          model.visitNodes(x => x instanceof TabNode && output.push(x));
          return output;
        },
        disabled: !props.initEnabled,
        pagePathname: location.pathname,
      };
    }
    useSiteStore.setState({});

    return () => void delete useSiteStore.getState().tabs[props.id];
  }, [model]);
}

function factory(node: TabNode) {
  const meta = node.getConfig() as TabMeta;
  console.log({meta});
  return <Portal {...meta} />;
}
