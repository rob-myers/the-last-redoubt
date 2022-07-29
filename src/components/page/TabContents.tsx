import React from 'react';

import { getTabName } from 'model/tabs/tabs.model';
import useSiteStore, { KeyedComponent } from 'store/site.store';
import { Terminal } from 'components/dynamic';

export default function TabContents({ tabsKey, component: { meta, component } }: Props) {

  const componentKey = getTabName(meta);
  const disabled = useSiteStore(({ component: lookup }) => lookup[componentKey].disabled[tabsKey]);

  return (
    meta.type === 'component' && (
      component && React.createElement(component, { disabled })
    ) || meta.type === 'terminal' && (
      <Terminal disabled={disabled} sessionKey={meta.filepath} env={meta.env || {}} />
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
