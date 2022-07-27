import React from 'react';

import { getCode } from 'model/tabs/lookup';
import { getTabName } from 'model/tabs/tabs.model';
import CodeViewer from 'components/code/CodeViewer';
import useSiteStore, { KeyedComponent } from 'store/site.store';
import { Terminal } from 'components/dynamic';

export default function TabContents({ tabsKey, component: { meta, component } }: Props) {

  const componentKey = getTabName(meta);
  const disabled = useSiteStore(({ component: lookup }) => lookup[componentKey].disabled[tabsKey]);

  return (
    meta.type === 'code' && (
      <CodeViewer
        filepath={meta.filepath}
        code={getCode(meta.filepath)}
      />
    ) || meta.type === 'component' && (
      component && React.createElement(component, { disabled })
    ) || meta.type === 'terminal' && (
      <Terminal disabled={disabled} sessionKey={meta.filepath} env={meta.env || {}} />
    ) || (
      <div style={{ background: 'white', color: 'red' }}>
        TabMeta has unexpected type {JSON.stringify(meta)}
      </div>
    )
  );
}

interface Props {
  tabsKey: string;
  component: KeyedComponent;
}
