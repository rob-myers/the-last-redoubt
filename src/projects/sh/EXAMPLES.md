# Examples of commands

__TODO__

## Local variables

```sh
( local y=42; echo $y )
( local y='{ foo: 42 }'; y/foo )
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
```

```sh
npc events | filter 'x => x.key === "stopped-walking"'
# versus
npc events | filter 'x => x.key === "way-point" && x.meta.final'

npc events | filter 'x => x.key === "way-point" && x.meta.key === "exit-room"'

expr '{ npcKey: "foo", point: '$( click 1 )' }' | spawn
spawn bar zhodani-a "$( click 1 )"
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

npc lit $( click 1 )
npc lit $( click 1 ) 0
npc lit $( click 1 ) 1
```
