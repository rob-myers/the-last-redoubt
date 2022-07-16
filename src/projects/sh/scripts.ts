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
    
  /** NOTE `map console.log` would log the 2nd arg too */
  log: `{
    map 'x => console.log(x)'
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
    filter 'x => ["no-ui", "nav"].every(tag => x.tags.includes(tag))' |
    map 'x => ({ npcKey: "'$1'", point: x })' |
    nav |
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
  'profile-1': () => `

source /etc/util-1
source /etc/game-1

`.trim(),

  'profile-1-a': () => `
${profileLookup["profile-1"]()}

# await world
ready

spawn andros '{"x":185,"y":390}'
# why now needed?
sleep 0.2
npc set-player andros

# camera follows andros
track andros &
# click navmesh to move
goLoop andros &
# click outside navmesh to look
lookLoop andros &
`,
};

//@ts-ignore
import rawLoaderJs from './raw-loader';
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
