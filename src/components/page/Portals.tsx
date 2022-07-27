import React from 'react';
import { css } from '@emotion/css';
import * as portals from "react-reverse-portal";

import { getCode, getComponent } from 'model/tabs/lookup';
import useSiteStore, { KeyedComponent, KeyedPortal } from "store/site.store";
import { CodeViewer, Terminal } from 'components/dynamic';
import { profileLookup } from 'projects/sh/scripts';

export default function Portals() {
  const lookup = useSiteStore(site => site.component);
  const items = Object.values(lookup).filter((x): x is KeyedPortal => !!x.portal);

  const [, setCount] = React.useState(0);

  React.useEffect(() => {
    items.forEach(async item => {
      if (item.meta.type === 'component' && !item.component) {
        item.component = await getComponent(item.meta.filepath) as KeyedComponent['component'];
        setCount(x => ++x);
      }
    });
  }, [items]);
  
  return <>
    {items.map((state) => {
      const { key, meta, portal } = state;
      switch (meta.type) {
        case 'code':
          // Currently no reason to persist,
          // yet we include it for uniformity
          return (
            <portals.InPortal key={key} node={portal}>
              <CodeViewer
                filepath={meta.filepath}
                code={getCode(meta.filepath)}
              />
            </portals.InPortal>
          );
        case 'component': {
          return (
            <portals.InPortal key={key} node={portal}>
              {state.component && <state.component />}
            </portals.InPortal>
          );
        }
        case 'terminal': {
          const env = meta.env || {};
          env.PROFILE = env.PROFILE || profileLookup['profile-1']();

          return (
            <portals.InPortal key={key} node={portal}>
              <Terminal disabled sessionKey={meta.filepath} env={env} />
            </portals.InPortal>
          );
        }
        default:
          return (
            <portals.InPortal key={key} node={portal}>
              <ErrorMessage>
                ⚠️ Unknown Tab with meta "{JSON.stringify(meta)}".
              </ErrorMessage>
            </portals.InPortal>
          );
      }
    })}
  </>
}

function ErrorMessage({ children }: React.PropsWithChildren<{}>) {
  return (
    <div className={errorCss}>
      <strong>{children}</strong>
    </div>
  );
}

const errorCss = css`
  margin: 24px;
  color: red;
  font-size: 1.2rem;
  font-family: monospace;
`;
