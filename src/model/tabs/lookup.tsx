import React from 'react';

const code = {
  // 'panzoom/PanZoom.jsx': () =>
  //   import('!!raw-loader!projects/panzoom/PanZoom.jsx'),
  // 'example/SvgPanZoomDemo.jsx': () =>
  //   import('!!raw-loader!projects/example/SvgPanZoomDemo.jsx'),
  // 'example/SvgStringPull.jsx': () =>
  //   import('!!raw-loader!projects/example/SvgStringPull.jsx'),
  // 'example/jsx-to-js.jsx': () =>
  //   import('!!raw-loader!projects/example/jsx-to-js.jsx'),
  'geom/rect.js': () =>
    import('!!raw-loader!projects/geom/rect'),
  'world/NPCs.jsx': () =>
    import('!!raw-loader!projects/world/NPCs.jsx'),
  'world/World.jsx': () =>
    import('!!raw-loader!projects/world/World.jsx'),
} as const;

const component = {
  'example/Images#geomorph-301': () => import('projects/example/Images')
    .then(x => (props: any) => <x.default {...props} srcKey='geomorph-301' />),
  'example/Images#redoubt-sketches': () => import('projects/example/Images')
    .then(x => (props: any) => <x.default {...props} srcKey='redoubt-sketches' />),
  'example/SvgStringPull': () => import('projects/example/SvgStringPull')
    .then(x => (props: any) => <x.default disabled {...props} />),
  'example/SvgNavGraph#101': () => import('projects/example/SvgNavGraph')
    .then(x => (props: any) => <x.default disabled {...props} layoutKey='g-101--multipurpose' />),
  'example/SvgNavGraph#301': () => import('projects/example/SvgNavGraph')
    .then(x => (props: any) => <x.default disabled {...props} layoutKey='g-301--bridge' />),

  'geomorph/GeomorphEdit': () => import('projects/geomorph/GeomorphEdit')
    .then(x => (props: any) => <x.default disabled {...props} />),

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

export async function getCode(key: CodeFilepathKey) {
  return code[key]?.().then(x => x.default) || (
    `Code not found: ${key}`
  );
}

export async function getComponent(key: ComponentFilepathKey) {
  return component[key]?.() || (
    () => <div>Component not found: {key}</div>
  );
}

export async function ensureWorldComponent({
  key,
  props,
}: WorldComponentDef) {
  const lookup = component as Record<string, (typeof component)[ComponentFilepathKey]>;
  if (!lookup[key]) {
    lookup[key] = () => import('projects/world/World')
      // `extraProps` may include { disabled: false }
      .then(x => (extraProps: WorldComponentDef['props']) =>
        <x.default disabled {...props} {...extraProps} />
      )
  }
}

export type CodeFilepathKey = keyof typeof code;
export type ComponentFilepathKey = keyof typeof component;

export interface WorldComponentDef {
  /** Tab name and unique identifier e.g. `props.worldKey` */
  key: string;
  props: import('projects/world/World').Props;
}
