# Examples of commands

__TODO__

## Local variables

```sh
( local y=42; echo $y )
( local y='{ foo: 42 }'; y/foo )
```

## if then elif else

```sh
if true; then echo foo; else echo bar; fi
if false; then echo foo; else echo bar; fi
if false; then echo foo; elif true; then echo bar; else echo baz; fi
if false; then echo foo; elif false; then echo bar; else echo baz; fi

# using builtin `test`
if test '1 > 2'; then echo TEST PASSED; else echo TEST FAILED; fi
if test '2 > 1'; then echo TEST PASSED; else echo TEST FAILED; fi
```

## Invoke JS function

```sh
$ call '({ home }) => { home.func = () => console.log("wow") }'
# we cannot simply `func()` because collides with shell function syntax
$ func'()'
```

```sh
$ run '({ api, home }) {  await new Promise(resolve => { api.addCleanup(home.resolve = resolve); }); yield "done"; }' &
$ ps
pid   ppid  pgid 
0     0     0    ▶️  ps
12    0     12   ▶️  run '({ api, home }) {  await  ...
$ resolve'()'
done
```

## Builtins

```sh
echo 'echo hello $@' >foo
source foo rob m
```

## NPC

```sh
npc decor | split

npc decor '{ key: "foo", type: "circle", center: {"x":207.83,"y":384.43}, radius: 30 }'
npc decor foo
echo foo | npc decor

npc decor '{ key: "bar", type: "rect", "x":207.83,"y":384.43,"width":100,"height":50 }'

npc decor '{ key: "bar", type: "point", "x":148.95,"y":393.96, tags:["decor"] }'

npc rm-decor bar
npc rm-decor 'foo bar'
```

```sh
view '{ point:'$( click 1 )'}'
```

```sh
npc get andros | map 'x => x.setLookRadians(0)'
```

```sh
npc look-at andros $( click 1 )
```

```sh
npc events |
  filter 'e => e.key === "decor-click" && (
    e.decor.meta.stand || e.decor.meta.sit
  )' |
  filter '(e, { api, home }) => {
    const { npcs } = api.getCached(home.WORLD_KEY);
    const player = npcs.getPlayer();
    if (player) {
      return player.getPosition().distanceTo(e.decor) <= player.getInteractRadius()
    }
  }'
```

```sh
npc get andros >me
me/animateOpacity'(0.5, 0)'
```

```sh
expr '{ npcKey: "foo", point:'$( click 1 )'}' | npc do '{ suppressError: 1 }'

npc do '{ npcKey: "foo", point:'$( click 1 )'}'
npc do foo $( click 1 )

# foo close door at
npc do foo $( click 1 ) 0
# foo open door at
npc do foo $( click 1 ) 1
```

```sh
npc events | filter 'x => x.key === "stopped-walking"'
# versus
npc events | filter 'x => x.key === "way-point" && x.meta.final'

npc events | filter 'x => x.key === "way-point" && x.meta.key === "exit-room"'

expr '{ npcKey: "foo", point: '$( click 1 )' }' | spawn
spawn bar zhodani "$( click 1 )"
```

## Migrating

> https://github.com/rob-myers/rob-myers.github.io/blob/codev/docs/commands.md

```sh
call '() => ({ x: 2, y: -9 })'
{ x: 2, y: -9 }
# gold because not a string

call '() => ({ x: 2, y: -9 })' >bar
bar
{ x: 2, y: -9 }

bar/x
2
```

```sh
# get roomGraph nodes ≤ 4 edges away from $roomId
gm 0 "gm => gm.roomGraph.getReachableUpto($roomId, (_ , depth) => depth > 4)"
```

## Demo

```sh
declare -F
declare -f range
range
range 10
declare -f split
range 10
range 10 | split
range 10 | split | map 'x => x + 1'
range 10 | split | map 'x => x + 1' |
  run '({ api, datum }) {
    while ((datum = await api.read()) !== null) {
      yield* api.sleep(1);
      yield datum;
    } }'
# Ctrl-C
```

```sh
range 5 |
  split |
  run '({ api, datum }) {
    while ((datum = await api.read()) !== null) {
      yield* api.sleep(1);
      yield datum;
    } }' |
  map 'x => `Hello ${x}`'
```

```sh
seq 5 | flatMap 'x => x < 2 ? [] : [x,x]'
```

```sh
npc map show
npc map hide
npc map # returns real number in [0, 1]

npc light $( click 1 )
npc light $( click 1 ) 0
npc light $( click 1 ) 1
```


```sh
world 'x => x.fov'
world "x => x.gmGraph.findRoomContaining($( click 1 ))"
gm 0 'x => x.roomGraph'
```


```sh
world 'x => x.npcs.getRandomRoom(
  (meta, gmId) => gmId === 1, // in geomorph 1
  (meta) => !meta.hull && !meta.leaf, // not a hull/leaf room
)'
# {"gmId":1,"roomId":14}
world 'x => x.npcs.getRandomRoomNavpoint(1, 14)'
# {"x":674.04,"y":784.8199999999999}
nav andros $_ --tryOpen | walk andros
# off we go...

nav --tryOpen andros $(
  world 'x => x.npcs.getRandomRoomNavpoint(4, 5)'
) | walk andros
```

```sh
# slice a navPath
nav --tryOpen andros $( click 1 ) > navPath
world '(x, { home }) => x.npcs.service.sliceNavPath(home.navPath, 4, -1)' >navPath2
```

```sh
npc events | map 'x => [x.key, x.meta?.key]'
```