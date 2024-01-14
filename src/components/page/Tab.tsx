import React from "react";
import useSiteStore, { KeyedComponent } from "store/site.store";
import { getTabIdentifier, TabMeta } from "model/tabs/tabs.model";
import { getComponent } from "model/tabs/lookup";
import TabContents from "./TabContents";

export default function Tab(props: Props) {

  const componentKey = getTabIdentifier(props);
  const component = useSiteStore(({ component }) =>
    componentKey in component ? component[componentKey] : null,
  );

  useEnsureComponent(props, component);

  return component
    ? <TabContents tabsKey={props.tabsKey} component={component} />
    : null;
}

function useEnsureComponent(
  { tabsKey, ...meta }: Props,
  component: KeyedComponent | null,
) {
  // 🚧 site.store.ts:135 Warning: Cannot update a component (`Tab`) while rendering a different component (`Layout`). To locate the bad setState() call inside `Layout`,
  React.useEffect(() => {
    if (component) {
      if (JSON.stringify(component.meta) !== JSON.stringify(meta)) {
        console.warn('Saw different TabMeta\'s with same induced name', component.meta, meta);
      }
      component.instances++;
      component.disabled[tabsKey] = true; // ?
    } else {
      createKeyedComponent(tabsKey, meta).then(
        createdComponent => {
          window.setTimeout(() => {
            // If parent tabs not disabled, wake this component, e.g.
            // - wake 1st tab if tabs initially enabled
            // - wake 2nd tab on 1st show
            // - don't wake 1st tab when initially disabled
            const parentTabs = useSiteStore.getState().tabs[tabsKey];
            if (parentTabs?.disabled === false) {
              setTimeout(() => {
                useSiteStore.api.setTabDisabled(parentTabs.key, createdComponent.key, false);
              }, 300);
            }
          });
        }
      );
    }
  }, []);
}

type Props = TabMeta & { tabsKey: string };

export async function createKeyedComponent(
  tabsKey: string,
  meta: TabMeta,
  disabled = true,
) {
  const componentKey = getTabIdentifier(meta);

  const item: KeyedComponent = {
    key: componentKey,
    instances: 1,
    meta,
    disabled: { [tabsKey]: disabled },
    component: meta.type === 'component'
      ? await getComponent(meta) as KeyedComponent['component']
      : undefined,
  };

  useSiteStore.setState(({ component }) => ({
    component: { ...component, [componentKey]: item },
  }), undefined, 'create-component');

  return item;
}