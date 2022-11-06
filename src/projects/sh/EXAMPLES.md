# Examples of commands

__TODO__

## Misc

```sh
declare -F
declare range
range
range 10
declare split
range 10
range 10 | split
range 10 | split |
  run '({ api, datum }) {
    while ((datum = await api.read()) !== null) {
      yield* api.sleep(1);
      yield datum;
    } }'
# Ctrl-C
range 10 | split | map 'x => x + 1'
# Every value is truthy, so can do
range 10 | split | map 'x => x + 1' |
  run '({ api, datum }) {
    while (datum = await api.read()) {
      yield* api.sleep(1);
      yield datum;
    } }'
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
```