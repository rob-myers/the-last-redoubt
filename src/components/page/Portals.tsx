import React from 'react';
import { css } from '@emotion/css';
import * as portals from "react-reverse-portal";

import { getComponent } from 'model/tabs/lookup';
import useSiteStore, { PortalState } from "store/site.store";
import { Terminal } from 'components/dynamic';
import { profileLookup } from 'projects/sh/scripts';

export default function Portals() {
  const lookup = useSiteStore(site => site.portal);
  const items = Object.values(lookup);

  const [, setCount] = React.useState(0);
  React.useLayoutEffect(() => {
    items.forEach(async item => {
      if (item.meta.type === 'component' && !item.component) {
        item.component = await getComponent(item.meta.filepath) as PortalState['component'];
        setCount(x => ++x);
      }
    });
  }, [items]);
  
  return <>
    {items.map((state) => {
      const { key, meta, portal } = state;
      switch (meta.type) {
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
        case 'code': // Unreachable
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
