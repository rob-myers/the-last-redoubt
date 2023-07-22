/**
 * - Index in array denotes version
 * - We further populate using raw-loader.js below.
 */
export const utilFunctions = [
{
  range: `{
    call '({args}) =>
      [...Array(Number(args[0]))].map((_, i) => i)
    ' "$1"
}`,
    
  seq: `{
    range "$1" | split
}`,
    
  pretty: `{
    map '(x, { api }) => api.pretty(x)'
}`,
    
  keys: `{
    map Object.keys
}`,
  
  // cat: `get "$@" | split`,
  cat: `get "$@"`,
    
  /**
   * - initially logs args, afterwards logs stdin
   * - `map console.log` would log 2nd arg too
   * - logs chunks larger than 1000, so e.g. `seq 1000000 | log` works
   */
  log: `{
    run '({ api, args, datum }) {
      args.forEach(arg => console.log(arg))
      if (api.isTtyAt(0)) return
      while ((datum = await api.read(true)) !== null) {
        if (datum.__chunk__ && datum.items?.length <= 1000) {
          datum.items.forEach(x => console.log(x))
        } else {
          console.log(datum)
        }
      }
    }' $@
}`,

  empty: `{
    return $(
      call '({ args }) => args.some(Boolean) ? 1 : 0' "$@"
    )
}`,

  clone: `{
    map 'x => JSON.parse(JSON.stringify(x))'
}`,

},
];

/**
 * - Index in array denotes version
 * - We further populate using raw-loader.js below.
 */
export const gameFunctions = [
{

/** Usage: doLoop {npcKey} */
doLoop: `{
  click | map 'p =>
    (p.meta.do || p.meta.nav || p.meta.door)
      ? { npcKey: "'$1'", point: p }
      : undefined
  ' | npc do {suppressThrow:true}
}`,

/**
 * Usage: goLoop {npcKey}
 * - meta.nav means the point must be on navmesh
 * - !meta.ui prevents immediate movement on open door
 * - !meta.do isolates from `doLoop`
 * - --safeLoop needed because npc $1 can be off-mesh
 */
goLoop: `{
  click |
    filter 'x => x.meta.nav && !x.meta.ui && !x.meta.do' |
    nav --safeLoop --preferOpen $1 |
    walk $1
}`,

/** Usage: goOnce {npcKey} */
goOnce: `{
  nav $1 $(click 1) | walk $1
}`,

/** Usage: lookLoop {npcKey} */
lookLoop: `{
  click |
    # do not look towards navigable or doable points
    filter 'x => !x.meta.nav && !x.meta.do' |
    look $1
}`,

/** Usage: thinkLoop {npcKey} */
thinkLoop: `{
  click |
    filter 'x => x.meta.npc' |
    run '({ api, args, home, datum }) {
      const npcKey = args[0]
      const { fov } = api.getCached(home.WORLD_KEY)
      while ((datum = await api.read(true)) !== null) {
        if (datum.meta.npcKey === npcKey) {
          fov.mapAct("show-for-ms", 3000)
        }
      }
    }' $1
}`,

/**
 * - Usage: world 'x => x.fov'
 * - Usage: world "x => x.gmGraph.findRoomContaining($( click 1 ))"
 */
world: `{
  call '({ api, home }) => api.getCached(home.WORLD_KEY)' |
    map "$\{1:-x=>x}"
}`,

/** Usage: gm {gmId} [selector] */
gm: `{
  call '({ api, home }) => api.getCached(home.WORLD_KEY).gmGraph.gms['$1']' |
    map "$\{2:-x=>x}"
}`,

},
];

/**
 * Possible values for env.PROFILE.
 * Use functions so can reference other profiles.
 * Remember to invoke function (MDX lacks intellisense).
 */
export const profileLookup = {

util_0: () => `

source /etc/util-1

`.trim(),

game_0: () => `

source /etc/util-1
source /etc/game-1

`.trim(),

game_1: (npcKey = 'andros') => `

source /etc/util-1
source /etc/game-1

awaitWorld
spawn ${npcKey} '{"x":210,"y":390}'
npc set-player ${npcKey}
npc map show-for-ms 2000

# camera follows ${npcKey}
track ${npcKey} &
# click navmesh to move
goLoop ${npcKey} &
# click outside navmesh to look
lookLoop ${npcKey} &
# click do points to do things
doLoop ${npcKey} &
# on click npc head ...
thinkLoop ${npcKey} &

`.trim(),

game_2: () => `
${profileLookup.game_1()}

npc config '{ debugPlayer: true, hideGms: true, showColliders: true, showIds: true }'
`

};

import rawLoaderJs from '!!raw-loader!./raw-loader';
Function(
  'utilFunctions',
  'gameFunctions',
  rawLoaderJs,
)(utilFunctions, gameFunctions);

/**
 * This is `/etc`.
 * It must be computed after we've extended {util,game}Functions via raw-loader.
 */
export const scriptLookup = {
  'util-1': Object.entries(utilFunctions[0])
    .map(([funcName, funcBody]) => `${funcName} () ${funcBody.trim()}`
  ).join('\n\n'),

  'game-1': Object.entries(gameFunctions[0])
    .map(([funcName, funcBody]) => `${funcName} () ${funcBody.trim()}`
  ).join('\n\n'),
};
