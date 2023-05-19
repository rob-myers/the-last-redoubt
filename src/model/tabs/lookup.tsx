import React, { ComponentProps } from 'react';
import loadable, { LoadableLibrary } from '@loadable/component';
import { TabMeta } from './tabs.model';

const classToComponent: Record<ComponentClassKey, {
  loadable: LoadableLibrary<any>;
  get(module: any): (props: any) => JSX.Element;
}> = {
  World: {
    loadable: loadable(() => import('projects/world/World')),
    get: (module: typeof import('projects/world/World')) =>
      (props: ComponentProps<typeof module['default']>) =>
        <module.default disabled {...props} />,
  },
  GeomorphEdit: {
    loadable: loadable(() => import('projects/geomorph/GeomorphEdit')),
    get: (module: typeof import('projects/geomorph/GeomorphEdit')) =>
      (props: ComponentProps<typeof module['default']>) =>
        <module.default disabled {...props} />,
  },
  SvgNavGraph: {
    loadable: loadable(() => import('projects/example/SvgNavGraph')),
    get: (module: typeof import('projects/example/SvgNavGraph')) =>
      (props: ComponentProps<typeof module['default']>) =>
        <module.default disabled {...props} />,
  },
  SvgStringPull: {
    loadable: loadable(() => import('projects/example/SvgStringPull')),
    get: (module: typeof import('projects/example/SvgStringPull')) =>
      (props: ComponentProps<typeof module['default']>) =>
        <module.default disabled {...props} />,
  },
}

export async function getComponent(meta: Extract<TabMeta, { type: 'component' }>) {
  return classToComponent[meta.class]?.get(
    await classToComponent[meta.class].loadable.load() as any
  ) ?? FallbackComponentFactory(meta.filepath)
}

export type ComponentClassKey = (
  | 'GeomorphEdit'
  | 'SvgStringPull'
  | 'SvgNavGraph'
  | 'World'
)

export interface WorldComponentDef {
  /** Tab name and unique identifier e.g. `props.worldKey` */
  key: string;
  props: import('projects/world/World').Props;
}

function FallbackComponentFactory(componentKey: string) {
  return () => (
    <div style={{ color: 'white', padding: '0 8px', fontSize: 20 }}>
      Component "{componentKey}" not found
    </div>
  );
}
