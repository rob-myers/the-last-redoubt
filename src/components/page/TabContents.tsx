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
        // we propagate props from <Tabs> prop tabs into component
        ...meta.props,
      })
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
