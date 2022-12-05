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
},
];

/**
 * - Index in array denotes version
 * - We further populate using raw-loader.js below.
 */
export const gameFunctions = [
{

goLoop: `{
  click |
    filter 'x => x.tags.includes("no-ui") && x.tags.includes("nav")' |
    nav $1 |
    walk $1
}`,

goOnce: `{
  nav $1 $(click 1) | walk $1
}`,

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

'profile-0': () => `source /etc/util-1
`,

'profile-1': () => `

source /etc/util-1
source /etc/game-1

`.trim(),

'profile-1-a': (npcKey = 'andros') => `

${profileLookup["profile-1"]()}
awaitWorld
spawn ${npcKey} '{"x":185,"y":390}'
npc set-player ${npcKey}

# camera follows ${npcKey}
track ${npcKey} &
# click navmesh to move
goLoop ${npcKey} &
# click outside navmesh to look
lookLoop ${npcKey} &

npc config showIds
npc config showLabels

`.trim(),

'profile-1-b': () => `
${profileLookup["profile-1-a"]()}
npc config debug
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
