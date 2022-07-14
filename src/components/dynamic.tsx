import loadable from '@loadable/component'
import type ActualLayout from './page/Layout';
import type ActualCodeEditor from './code/CodeEditor';
import type ActualTerminal from './sh/Terminal';

export const Layout = loadable(
  () => import('./page/Layout'),
  { ssr: false },
) as typeof ActualLayout;

export const CodeEditor = loadable(
  () => import('./code/CodeEditor'),
  { ssr: false },
) as typeof ActualCodeEditor;

export const Terminal = loadable(
  () => import('./sh/Terminal'),
  { ssr: false },
) as typeof ActualTerminal;
