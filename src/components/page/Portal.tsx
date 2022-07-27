import React from "react";
import * as portals from "react-reverse-portal";
import useSiteStore, { KeyedComponent, KeyedPortal } from "store/site.store";
import { getTabName, TabMeta } from "model/tabs/tabs.model";

export default function Portal(props: TabMeta) {
  const componentKey = getTabName(props);
  const state = useSiteStore(({ component }) =>
    componentKey in component ? component[componentKey] : null,
  );

  useEnsurePortal(props, state);

  return state?.portal
    ? <portals.OutPortal node={state.portal} />
    : null;
}

function useEnsurePortal(
  meta: TabMeta,
  portal: KeyedComponent | null,
) {
  React.useEffect(() => {
    if (!portal) {
      const { portal: htmlPortalNode } = createPortal(meta);

      window.setTimeout(() => {
        // If parent <Tabs/> not disabled, wake this portal up, e.g.
        // - wake 1st tab if tabs initially enabled
        // - wake 2nd tab on 1st show
        // - don't wake 1st tab when initially disabled
        const currentTabs = Object.values(useSiteStore.getState().tabs).filter(tabs => tabs.pagePathname === location.pathname);
        const parentTabs = currentTabs.find(tabs => tabs.def.some(x => x.filepath === meta.filepath));
        if (parentTabs && !parentTabs.disabled) {
          setTimeout(() =>  htmlPortalNode.setPortalProps({ disabled: false }), 300);
        }
      });

    } else if (JSON.stringify(portal.meta) !== JSON.stringify(meta)) {
      console.warn('Saw different TabMetas with same portalKey', portal.meta, meta);
    }
  }, []);
}

export function createPortal(meta: TabMeta) {
  const componentKey = getTabName(meta);
  const htmlPortalNode = portals.createHtmlPortalNode({
    attributes: { class: 'portal' },
  });

  const item: KeyedPortal = {
    key: componentKey,
    instances: 1,
    meta,
    portal: htmlPortalNode,
    setDisabled(disabled) {
      htmlPortalNode.setPortalProps({ disabled });
    },
  };

  useSiteStore.setState(({ component }) => ({
    component: { ...component, [componentKey]: item },
  }));

  return item;
}