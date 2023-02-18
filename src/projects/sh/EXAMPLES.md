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
npc decor '{ key: "foo", type: "circle", center: {"x":207.83,"y":384.43}, radius: 30 }'
npc decor foo
echo foo | npc decor

npc decor '{ key: "bar", type: "rect", "x":207.83,"y":384.43,"width":100,"height":50 }'

npc decor '{ key: "bar", type: "point", "x":148.95,"y":393.96,"tags":["no-ui"], onClick: (x, y) => { console.log("foobar", x, y); y.npcs.writeToTtys("wahoo!"); } }'

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
# basic implementation of stand/sit points
npc events |
  filter 'e => e.key === "decor-click" && (
    e.decor.tags?.includes("stand") || e.decor.tags?.includes("sit")
  )' |
  filter '(e, { api, home }) => {
    const { npcs } = api.getCached(home.WORLD_KEY);
    const distance = npcs.getPlayer()?.getPosition().distanceTo(e.decor);
    return distance <= npcs.getNpcInteractRadius();
  }' |
  run '({ api, datum, home }) {
    const { npcs } = api.getCached(home.WORLD_KEY);
    const player = npcs.getPlayer(); 
    while ((datum = await api.read()) !== null) {
      await npcs.spawn({ npcKey: player.key, point: datum.decor });
      datum.decor.tags.includes("stand") && player.startAnimation("idle-breathe");
      datum.decor.tags.includes("sit") && player.startAnimation("sit");
    }
  }'
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
