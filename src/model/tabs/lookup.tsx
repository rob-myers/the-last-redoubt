import React, { ComponentProps } from 'react';
import loadable, { LoadableComponent } from '@loadable/component';

/**
 * Dynamically loaded component lookup.
 * TODO simplify
 */
const component = {

  'example/SvgStringPull': {
    persist: false,
    loadable: loadable.lib(() => import('projects/example/SvgStringPull')),
    get: (module: typeof import('projects/example/SvgStringPull')) =>
      (props: ComponentProps<typeof module['default']>) =>
        <module.default disabled {...props} />,
  },
  'example/SvgNavGraph#101': {
    persist: false,
    loadable: loadable.lib(() => import('projects/example/SvgNavGraph')),
    get: (module: typeof import('projects/example/SvgNavGraph')) =>
      (props: ComponentProps<typeof module['default']>) =>
        <module.default disabled {...props} layoutKey='g-101--multipurpose' />,
  },
  'example/SvgNavGraph#301': {
    persist: false,
    loadable: loadable.lib(() => import('projects/example/SvgNavGraph')),
    get: (module: typeof import('projects/example/SvgNavGraph')) =>
      (props: ComponentProps<typeof module['default']>) =>
        <module.default disabled {...props} layoutKey='g-301--bridge' />,
  },
  'example/SvgNavGraph#303': {
    persist: false,
    loadable: loadable.lib(() => import('projects/example/SvgNavGraph')),
    get: (module: typeof import('projects/example/SvgNavGraph')) =>
      (props: ComponentProps<typeof module['default']>) =>
        <module.default disabled {...props} layoutKey='g-303--passenger-deck' />,
  },
  'geomorph/GeomorphEdit': {
    persist: false,
    loadable: loadable.lib(() => import('projects/geomorph/GeomorphEdit')),
    get: (module: typeof import('projects/geomorph/GeomorphEdit')) =>
      (props: ComponentProps<typeof module['default']>) =>
        <module.default disabled {...props} />,
  },

  // 'example/SvgVisibilityDemo#301': () => import('projects/example/SvgVisibilityDemo')
  //   .then(x => (props: any) => <x.default disabled {...props} layoutKey='g-301--bridge' />),
  // 'example/Css3dForeignObject#301': () => import('projects/example/Css3dForeignObject')
  //   .then(x => (props: any) => <x.default disabled {...props} layoutKey='g-301--bridge' />),
  // 'example/SvgPanZoomDemo': () => import('projects/example/SvgPanZoomDemo')
  //   .then(x => x.default),
  // 'example/Pyramid3dDemo': () => import('projects/example/Pyramid3dDemo')
  //   .then(x => x.default),
  // 'example/SvgDoorsDemo#101': () => import('projects/example/SvgDoorsDemo')
  //   .then(x => (props: any) => <x.default disabled {...props} layoutKey='g-101--multipurpose' />),
  // 'example/SvgDoorsDemo#301': () => import('projects/example/SvgDoorsDemo')
  //   .then(x => (props: any) => <x.default disabled {...props} layoutKey='g-301--bridge' />),
  
  // 'example/SvgNavGraph#302': () => import('projects/example/SvgNavGraph')
  //   .then(x => (props: any) => <x.default disabled {...props} layoutKey='g-302--xboat-repair-bay' />),
  // 'example/LightsTest': () => import('projects/example/LightsTest')
  //   .then(x => x.default),
  // 'example/SvgNavDemo1': () => import('projects/example/SvgNavDemo1')
  //     .then(x => (props: any) => <x.default disabled {...props} />),
  // 'example/NavDemo1': () => import('projects/example/NavDemo1')
  //     .then(x => (props: any) => <x.default disabled {...props} />),
  // 'example/TriangleDev#301': () => import('projects/example/TriangleDev')
  //   .then(x => (props: any) => <x.default disabled {...props} layoutKey='g-301--bridge' />),
  // 'example/TriangleDev#101': () => import('projects/example/TriangleDev')
  //   .then(x => (props: any) => <x.default disabled {...props} layoutKey='g-101--multipurpose' />),
};

export async function getComponent(key: ComponentFilepathKey) {
  return component[key]
    ? component[key].get(await component[key].loadable.load() as any)
    : FallbackComponentFactory(key)
}

export function isComponentPersisted(key: string) {
  return key in component ? component[key as ComponentFilepathKey].persist : false;
}

export async function ensureWorldComponent({
  key,
  props,
}: WorldComponentDef) {

  const lookup = component as Record<string, {
    persist: boolean;
    loadable: LoadableComponent<any>;
    get: (module: { default: (props: any) => JSX.Element }) => (props: any) => JSX.Element;
  }>;

  if (!lookup[key]) {
    lookup[key] = {
      /**
       * Worlds are persisted over the entire site.
       * That is, changing page won't destroy them.
       */
      persist: true,
      loadable: loadable(() => import('projects/world/World')),
      get: (module: typeof import('projects/world/World')) =>
        // `extraProps` may include { disabled: false }
        (extraProps: ComponentProps<typeof module['default']>) =>
          <module.default disabled {...props} {...extraProps} />,
    };
  }
}

export type ComponentFilepathKey = keyof typeof component;

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
