import React from 'react';

import { getTabIdentifier } from 'model/tabs/tabs.model';
import useSiteStore, { KeyedComponent } from 'store/site.store';
import { Terminal } from 'components/dynamic';

export default function TabContents({
  tabsKey,
  component: { meta, component },
}: Props) {

  const componentKey = getTabIdentifier(meta);
  const disabled = useSiteStore(({ component: lookup }) => lookup[componentKey].disabled[tabsKey]);

  return (
    meta.type === 'component' && (
      component && React.createElement(component, {
        disabled,
        ...meta.props, // propagate props from <Tabs> prop tabs
      })
    ) || meta.type === 'terminal' && (
      <Terminal
        disabled={disabled}
        sessionKey={meta.filepath}
        env={meta.env ?? {}}
        onKey={(e) => {
          if (e.key === 'Escape') {
            const tabs = useSiteStore.getState().tabs[tabsKey];
            if (!tabs.disabled) tabs.toggleEnabled();
          }
          if (e.key === 'Enter') {
            const tabs = useSiteStore.getState().tabs[tabsKey];
            if (tabs.disabled) tabs.toggleEnabled();
          }
        }}
      />
    ) || (
      <div style={{ background: 'white', color: 'red' }}>
        TabMeta "{JSON.stringify(meta)}" has unexpected type
      </div>
    )
  );
}

interface Props {
  tabsKey: string;
  component: KeyedComponent;
}
