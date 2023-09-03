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

//   empty: `{
//     return $(
//       call '({ args }) => args.some(Boolean) ? 1 : 0' "$@"
//     )
// }`,

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
  click |
    filter 'p => p.meta.do || p.meta.nav || p.meta.door' |
    npc do --safeLoop $1
}`,

/**
 * Usage: goLoop {npcKey}
 * - ℹ️ when off-mesh, starts from closest navigable
 * - --safeLoop needed because npc $1 can be off-mesh
 */
goLoop: `{
  click |
    filter '({ meta }) => meta.nav && !meta.ui && !meta.do && !meta.longClick' |
    nav --safeLoop --preferOpen $1 |
    walk $1
}`,

// /** Usage: goOnce {npcKey} */
// goOnce: `{
//   nav $1 $(click 1) | walk $1
// }`,

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
    filter 'x => x.meta.npc && x.meta.npcKey === "'$1'"' |
    run '({ api, home }) {
      const { fov } = api.getCached(home.WORLD_KEY)
      while (await api.read(true) !== null)
        fov.mapAct("show-for-ms", 3000)
    }'
}`,

/**
 * 🚧 fix `local` and use instead
 * Usage:
 * - world
 * - world 'x => x.fov'
 * - world fov
 * - world doors.toggleLock 0 8
 * - world "x => x.gmGraph.findRoomContaining($( click 1 ))"
 * - world gmGraph.findRoomContaining $( click 1 )
 */
world: `{
  __TEMP_ARG_1="$\{1:-x=>x}"
  shift
  call '({ api, home }) => api.getCached(home.WORLD_KEY)' |
    map "$__TEMP_ARG_1" "$@"
}`,

/**
 * 🚧 fix `local` and use instead
 * Usage: gm {gmId} [selector]
 */
gm: `{
  __TEMP_ARG_1="$\{1:-0}"
  __TEMP_ARG_2="$\{2:-x=>x}"
  shift 2
  call '({ api, home }) => api.getCached(home.WORLD_KEY).gmGraph.gms['$__TEMP_ARG_1']' |
    map "$__TEMP_ARG_2" "$@"
}`,

/**
 * Usage:
 * - longClick 1
 * - longClick
 */
longClick: `{
  click | filter meta.longClick | take $1
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

game_1: (npcKey = 'rob') => `

source /etc/util-1
source /etc/game-1

awaitWorld
spawn ${npcKey} '{"x":210,"y":390}'
npc set-player ${npcKey}
npc map show-for-secs 2

track ${npcKey} &
click | controlNpc ${npcKey} &

`.trim(),
// # goLoop ${npcKey} &
// # lookLoop ${npcKey} &
// # doLoop ${npcKey} &
// # thinkLoop ${npcKey} &

game_2: () => `
${profileLookup.game_1()}

npc config '{
  debugPlayer: true,
  hideGms: true,
  showColliders: false,
  showIds: true,
  logTags: false,
}'
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
