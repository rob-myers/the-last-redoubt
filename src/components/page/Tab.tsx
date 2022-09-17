import React from "react";
import * as portals from "react-reverse-portal";
import useSiteStore, { KeyedComponent, KeyedPortal } from "store/site.store";
import { getTabIdentifier, TabMeta } from "model/tabs/tabs.model";
import { getComponent, isComponentPersisted } from "model/tabs/lookup";
import TabContents from "./TabContents";

export default function Tab(props: Props) {

  const componentKey = getTabIdentifier(props);
  const component = useSiteStore(({ component }) =>
    componentKey in component ? component[componentKey] : null,
  );

  useEnsureComponent(props, component);

  return component
    ? component.portal
      ? <portals.OutPortal node={component.portal} />
      : <TabContents tabsKey={props.tabsKey} component={component} />
    : null;
}

function useEnsureComponent(
  { tabsKey, ...meta }: Props,
  component: KeyedComponent | null,
) {
  React.useEffect(() => {
    if (component) {
      if (JSON.stringify(component.meta) !== JSON.stringify(meta)) {
        console.warn('Saw different TabMeta\'s with same induced name', component.meta, meta);
      }
      if (component.portal === null) {
        component.instances++;
        component.disabled[tabsKey] = true; // ?
      }
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
  let item: KeyedComponent;

  if (meta.type === 'terminal' || isComponentPersisted(componentKey)) {
    const htmlPortalNode = portals.createHtmlPortalNode({
      attributes: { class: 'portal' },
    });
    item = {
      key: componentKey,
      instances: 1,
      meta,
      portal: htmlPortalNode,
      // Unused in case of portal, yet kept up-to-date
      disabled: { [tabsKey]: disabled },
    };
  } else {
    item = {
      key: componentKey,
      instances: 1,
      meta,
      portal: null,
      disabled: { [tabsKey]: disabled },
      // This is done later in case of portal
      component: await getComponent(meta.filepath as any) as KeyedComponent['component'],
    };
  }

  useSiteStore.setState(({ component }) => ({
    component: { ...component, [componentKey]: item },
  }), undefined, 'create-component');

  return item;
}