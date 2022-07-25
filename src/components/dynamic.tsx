import React from 'react';
import type ActualLayout from './page/Layout';
import type ActualCodeViewer from './code/CodeViewer';
import type ActualTerminal from './sh/Terminal';
import { ensureWorldComponent, WorldComponentDef } from 'model/tabs/lookup';

export function Layout(props: React.ComponentProps<typeof ActualLayout>) {
  return typeof window !== "undefined"
    ? <LayoutLazy {...props} />
    : null;
}

export function CodeViewer(props: React.ComponentProps<typeof ActualCodeViewer>) {
  return typeof window !== "undefined"
    ? <CodeViewerLazy {...props} />
    : null;
}

export function Terminal(props: React.ComponentProps<typeof ActualTerminal>) {
  return typeof window !== "undefined"
    ? <TerminalLazy {...props} />
    : null;
}

const LayoutLazy = React.lazy(() => import('./page/Layout'));
const CodeViewerLazy = React.lazy(() => import('./code/CodeViewer'));
const TerminalLazy = React.lazy(() => import('./sh/Terminal'));

const worldComponents: WorldComponentDef[] = [
  {
    key: 'intro-world-1',
    props: {
      init: { open: { 0: [24] } },
      worldKey: 'intro-world-1',
      gms: [
        { layoutKey: 'g-301--bridge' },
        { layoutKey: 'g-301--bridge', transform: [1, 0, 0, -1, 0, 600 + 600], },
      ],
    },
  },
  {
    key: 'intro-world-2',
    props: {
      init: {},
      worldKey: 'intro-world-2',
      gms: [
        { layoutKey: 'g-301--bridge' },
        { layoutKey: 'g-301--bridge', transform: [1, 0, 0, -1, 0, 600 + 600], },
      ],
    },
  },
  {
    key: 'world-demo-1',
    props: {
      init: {},
      worldKey: 'world-demo-1',
      gms: [
        { layoutKey: 'g-301--bridge' },
        { layoutKey: 'g-101--multipurpose', transform: [1, 0, 0, 1, 0, 600] },
        { layoutKey: 'g-302--xboat-repair-bay', transform: [1, 0, 0, 1, -1200, 600] },
        { layoutKey: 'g-303--passenger-deck', transform: [1, 0, 0, -1, -1200, 1200 + 600] },
        { layoutKey: 'g-302--xboat-repair-bay', transform: [-1, 0, 0, 1, 1200 + 1200, 600] },
        { layoutKey: 'g-301--bridge', transform: [1, 0, 0, -1, 0, 600 + 1200 + 600], },
      ],
    },
  },
  {
    key: 'world-demo-2',
    props: {
      init: {},
      worldKey: 'world-demo-2',
      gms: [
        { layoutKey: 'g-301--bridge' },
        { layoutKey: 'g-301--bridge', transform: [1, 0, 0, -1, 0, 600 + 600], },
      ],
    },
  },
];

/**
 * This happens early enough via import dependency chain:
 * > `Root.tsx` -> `Portals.tsx` -> `dynamic.tsx` 
 */

worldComponents.forEach(ensureWorldComponent);
