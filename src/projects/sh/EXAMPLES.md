# Examples of commands

__TODO__

## GIF Demo

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

## Local variables

```sh
( local y=42; echo $y )
( local y='{ foo: 42 }'; y/foo )
```

## NPC

```sh
npc decor '{ key: "foo", type: "circle", center: {"x":207.83,"y":384.43}, radius: 30 }'
npc decor foo
echo foo | npc decor

# 🚧 seg -> rect
npc decor '{ key: "bar", type: "seg", src: {"x":207.83,"y":384.43}, dst: {"x":227.83,"y":384.43} }'
```

```sh
view '{ point:'$( click 1 )'}'
```

```sh
npc get andros | map 'x => x.setLookRadians(0)'
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