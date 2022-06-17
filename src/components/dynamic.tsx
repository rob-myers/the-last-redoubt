import loadable from '@loadable/component'

export const Layout = loadable(
  () => import('./page/Layout'),
  { ssr: false },
);

export const CodeEditor = loadable(
  () => import('./code/CodeEditor'),
  { ssr: false },
);
