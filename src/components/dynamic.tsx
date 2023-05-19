import loadable from '@loadable/component';
import type ActualLayout from './page/Layout';
import type ActualTerminal from './sh/Terminal';

export const Layout = loadable(
  () => import('./page/Layout'),
  { ssr: false },
) as typeof ActualLayout;

export const Terminal = loadable(
  () => import('./sh/Terminal'),
  { ssr: false },
) as typeof ActualTerminal;
