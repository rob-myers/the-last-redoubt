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
   * - `map console.log` would log 2nd arg too
   * - log chunks larger than 1000, so e.g. `seq 1000000 | log` works
   */
  log: `{
    run '({ api, args, datum }) {
      while ((datum = await api.read(true)) !== null) {
        if (datum.__chunk__ && datum.items?.length <= 1000) {
          datum.items.forEach(x => console.log(x))
        } else {
          console.log(datum)
        }
      }
    }'
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
  npc events |
    flatMap '({ key, decor }) =>
      key === "decor-click" && decor.tags?.includes("action")
      && { npcKey: "'$1'", point: { x: decor.x, y: decor.y }, tags: decor.tags } || []
    ' |
    npc do
}`,

/** Usage: goLoop {npcKey} */
goLoop: `{
  click |
    filter 'x => x.tags.includes("no-ui") && x.tags.includes("nav")' |
    nav $1 |
    walk $1
}`,

/** Usage: goOnce {npcKey} */
goOnce: `{
  nav $1 $(click 1) | walk $1
}`,

/** Usage: lookLoop {npcKey} */
lookLoop: `{
  click |
    filter 'x => !x.tags.includes("nav")' |
    look $1
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
spawn ${npcKey} '{"x":185,"y":390}'
npc set-player ${npcKey}

# camera follows ${npcKey}
track ${npcKey} &
# click navmesh to move
goLoop ${npcKey} &
# click outside navmesh to look
lookLoop ${npcKey} &

`.trim(),

game_2: () => `
${profileLookup.game_1()}

npc config '{ showIds: true, debug: true }'
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
