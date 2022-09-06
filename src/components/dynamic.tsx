import loadable from '@loadable/component';
import type ActualLayout from './page/Layout';
import type ActualTerminal from './sh/Terminal';
import { ensureWorldComponent, WorldComponentDef } from 'model/tabs/lookup';

//#region Individual components

export const Layout = loadable(
  () => import('./page/Layout'),
  { ssr: false },
) as typeof ActualLayout;

export const Terminal = loadable(
  () => import('./sh/Terminal'),
  { ssr: false },
) as typeof ActualTerminal;

//#endregion

//#region Worlds

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

//#endregion
