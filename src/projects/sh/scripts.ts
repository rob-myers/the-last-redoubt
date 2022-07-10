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

/** This is `/etc` */
export const scriptLookup = {
  'util-1': Object.entries(utilFunctions[0])
    .map(([funcName, funcBody]) => `${funcName} () ${funcBody.trim()}`
  ).join('\n\n'),

  // 'game-1': Object.entries(gameFunctions[0])
  //   .map(([funcName, funcBody]) => `${funcName} () ${funcBody.trim()}`
  // ).join('\n\n'),
};
