# TODO

## In progress

- 🚧 layout for gm 103
  - need a 5 * n with top wall removed

- ✅ cleanup e.g. `npc map {show-labels,hide-labels,show-labels-for}`
- BUG seems ``click | controlNpc rob` triggers walk from `spawn rob $( click 1 )`
  - the latter click should not be read?
- use animation.finished promise elsewhere to clean things up
- doors should be easier to open as player walks
- abstract code:
  > w.npcs.config.verbose && api.info(`ignored: ${/** @type {*} */ (e)?.message ?? e}`);
- pausing direction issue while `click | walk foo` ?

- example of picking something up
  - e.g. spawn decor, then fade/remove it, registering something inside npc
  - `npc decor '{ key: "bar", type: "point", ...'$( click 1 )', tags:["decor"] }'`
  - BUG saw issue where removed decor, but new decor in different room vanished on close door
  - icons for things we might want to pick up?

- return to homepage
  - emphasise "language" and "joining behaviours" on homepage

- ❌ `npc do` -> `act`
- ❌ head radius increases whilst walking?
- ❌ consider removing "peek view", or at least disabling
- tty unicode bug after PASTING "[ ▶️ ] [ ⏸ ] [ ❌ ]"
  - i.e. seemed one character off (prompt lost char)
  - `choice '[ ▶️  ](play) [ ⏸  ](pause) [ ❌  ](kill) '`

- ℹ️ can do `split` then send e.g. `foo` and see output `f`, `o`, `o`
- ℹ️ BUT does not work when pasting and include a subsequent newline e.g.
  ```sh
  split | map charCodeAt 0
  #
  ```

- BUG? multiple paste issue when reading tty?
  - consider `split ' ' | take 3` and paste multiple lines
- BUG CssPanZoom sometimes jerky when spawn a lot
- other NPC with `nav | walk --open` seems slow
- BUG `ps` final line malformed somehow, wrapped?
```sh
$ ps
pid   ppid  pgid 
0     0     0    ps
7     0     7    pausableNpcs &
9     8     9    [ on ] [ x ]  map '(p, { w }) => { ...
15    0     15   [ on ] [ x ]  track rob &
17    0     17   click | controlNpc rob &
18    17    18   [ on ] [ x ]  controlNpc rob
```
- ✅ cleanup NPC CLI i.e. fewer options

- track animation should stop on kill
- should track "pause" when tracked npc does?
  - currently `track` pauses if pause npc during walk
  - currently `track` does not pause if pause npc whilst stationary
- `track` jerky e.g. on click do point and immediately click navmesh
  - whilst running controlNpc
  - whilst `click | nav rob | npc rob walk`
- avoid swallowing errors in any npc function: always log out when verbose
- mobile pinch zoom too sensitive
- BUG `click | walk2 --open rob` can fail to open door, perhaps because collides first?
  - saw "next walk" stop immediately probably because of collision
- BUG on send empty command should not overwrite session.lastExitCode
- BUG? killError(_, exitCode) 2nd param working?
- BUG? saw npc-vs-npc collision failure near hull door
  - hard to reproduce
- clarify hard-coding in rayIntersectsDoor
- shell has api.argsToAction
- BUG with `npc config '{ scriptDoors: false }'`
  - doors open then close immediately
- BUG? sporadic 302 related hull door failure
- BUG safari desktop cursor disabled by default
  - `touch-tty-can-type`
- gm 101: if can get close to windows then view offset should be small (?)
- implications of error failing to propagate to shell from use-handle-events?
  - maybe catch and send message to shell?
- maybe `npc config hideGms` should hide FOV when true?
- saw unresponsive click until `spawn rob $p`
- cache connector.poly.center -> connector.center
- GeomorphEdit works on mobile
- check spawn uses correct ppid in every case

- 🚧 gm 301: add more symbols
  - ✅ fix view envelope bug when peeking in locker
  - ✅ experiment with side-table
  - ✅ various side-tables(s) in gm 301 corridor
  - 🚧 can change side-table colour
    - ✅ base PNG colour is white
    - ❌ geomorph-layouts supports `filter` 
      > https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter
      - ℹ️ node-canvas does not support it
    - ✅ can shade non-hull symbols via e.g. `poly fillColor=#00000044`
    - 🚧 more shadings
  - 🚧 other "furniture" e.g.
    - ground pipes
    - pipes
    - barrels
    - screens
    - noticeboards
    - plants

- cypress tests?

- ❌ can `filter '/events/.test'`
  - `/events/.test("foo")` doesn't work
- ✅ can `filter /events/`
- can `map /(\d+),(\d+)/ (match) => ...`

- ✅ start assuming that hullDoorId === doorId i.e. initial doors are hull doors
  - ℹ️ test based on `door.meta.hull` or `api.doors.lookup[gmId][doorId].hull`
  - ✅ remove `gm.getHullDoorId`

- ✅ saw fat door in 302
- tidy processApi via processApi.lib
- prevent nearNav from blocking do point?

- redo first peek video with 2 npcs
  - play around for a while first

```sh
spawn foo --zhodani $( click 1 )
nav foo rob | walk --open foo
nav --nearNpc foo rob | walk --open foo

# simple follow loop
while true; do
  nav --nearNpc foo rob | walk --open foo
  sleep 2
done
```

- redo do all the things video
- go thru page up until first behaviour
- back to behaviour on homepage!

- ✅ homepage: "The Experiment" narrative container
- 🚧 first NPC behaviour in section "Fabricating a behaviour"
  - ✅ can choose random room which is not hull or leaf, in another geomorph (if there is one) e.g.
    ```sh
    world 'x => x.npcs.getRandomRoom(
      (meta, gmId) => gmId === 1,
      (meta) => !meta.hull && !meta.leaf,
    )'
    ```
  - ✅ choose random navigable world point in given room
    - ℹ️ couldn't spawn to `{"x":-649.93,"y":1654.79}` because door was closed
      > `world 'x => x.npcs.getRandomRoomNavpoint(3, 12)'`
      > so we use `gm.floorGraph.strictRoomNodeIds`
  - ✅ can restrict global nav path to suffix via `{ startId }`
  - 🚧 find navpath from Player to random room
  - 🚧 npc spawns into open doorway
    - maybe can operate on navpaths e.g. slice/reverse?
  - npc walks into your current room
  - ...


- `npc pause andros` should pause e.g. goLoop, lookLoop
  - ℹ️ if only pause `walk` then e.g. `nav` in pipeline may create navPath
  - 🤔 useful to pause player, or other npc
  - IDEA track `npcs.session.npcToPids` and pause them too (possibly as incoming)?
    - e.g. `foo | { bar; walk andros }` and if `walk` has bg pid then ...
    - what about `while true; do foo; walk andros $navPath; bar; done`?
- can reverse navPath
- `npc lock {point} [on/off]`
- update CodeSandbox
- CodeSandbox supports url params layout, profile
  - Can supply url params to specify layout and profile?
  - https://codesandbox.io/s/tty-world-2-june-2023-g8tb0c?file=/src/service/geomorph.js

- ❌ homepage: interesting behavioural examples, rather than formal definitions
  - ✅ Tabs and Terminal on homepage with custom profile
  - ✅ support `view {ms} [{point}] [{zoom}]`
  - ✅ can cancel `view`
  - ✅ can pause/resume `view`
  - ✅ can set initial panzoom `ms`
  - ❌ player and npc exchange shifts
    - player on chair; npc goes to bed; npc turns light off; npc says "good night"
    - alt: player gets in way...

- ✅ support ansi color codes inside `choice` args
- HMR useGeomorphs?
- BUG? saw collision detect fail whilst Player was still
- BUG cannot paste into line
- BUG resized input on last 3 lines can overwrite 1 or 2 lines
  - ℹ️ not so bad
  - ℹ️ should only solve once we understand `numLines` in `clearInput`
- consider `persist` CssPanZoom animations
  > https://developer.mozilla.org/en-US/docs/Web/API/Animation/persist
- BUG? npc-npc missed collision when other npc left navmesh
  - both were going around table same way
  - npc is outside navmesh: {"x":652.47,"y":465.58}
- `nav --locked={weight} --keys=$( npc foo 'x => x.has.keys' )` takes keys into account
- track still jerky when walk slow-down/speed-up
- BUG anim jumps when change speed without setTimeout
  - ✅ avoid re-predicting decor collisions (leave them + re-setTimeout)
  - not setSpeedFactor collision
  - initialization?
- BUG? npc-npc collide miss: HMR related?
```sh
# REPRO ❌
spawn foo --zhodani {"x":511.5,"y":876.5}
spawn rob {"x":459.36,"y":796.65}
nav --nearNpc foo rob | walk --open foo
```

- Do we need `component` lookup in site.store?
- BUG some door's border flashes on npc move
- Doors: CSS -> WAAPI (?)
- 🤔 BUG tty long input overflow *responsive* deformation
- simplify individual doors
- BUG Escape Tabs not working when click on tabs bar
  - probably interference from tab dragger
- BUG react_devtools_backend_compact.js:2367 ERROR g-301--bridge: hull door 0: w: failed to parse transform "0,1,-1,0,1800,0" 
- restyle nav menu?
- can tag symbol decor `global`
  - ℹ️ local decor resets on re-enter
- support cleaner `npc do {npcKey} $( click 1 )`
  - currently `npc do '{ npcKey: "foo", point:'$( click 1 )'}'`
- unfortunately "ℹ️" does not look good on some windows machines
- hide inline carousel when maximised?
- properly type code relating to `normalizeNpcCommandOpts`

- ✅ remove tag `no-turn`?
- ❌ clean up bridge window/fuel?
- ✅ respawn on do point should trigger action
  - seems we're clicking npc, not a do point

- 🚧 play with Chrome devtool recorder
  - can replay via https://www.npmjs.com/package/@puppeteer/replay
  - puppeteer could be integrated with CodeSandbox?

- add npc class hlanssai-a
  - somehow import njoy games sprites into Spriter Pro
- npcs-meta.json has timestamps to avoid process-sheets recomputing everything
- ensure doors pause and/or initially can start open
  - maybe use web animations api?
- redo labels in svg symbols as actual text (8px * 5 = 40px)

- BUG .panzoom-scale stale animation...
  - `$1.getAnimations()[0].cancel()`
- BUG? `click 1>foo`
- BUG? HMR sometimes seems to break FOV change on enter room
- BUG walk tracked npc and wait for finish; pause and unpause causes re-track
- BUG spawned into toilet without triggering FOV change
- Spriter Pro: put hat opacity back at 100% but hide using character map
- BUG gatsby watch static/assets
  ```sh
  [0]   Error: ENOENT: no such file or directory, copyfile '/Users/Robert.Myers/coding
  [0]   /the-last-redoubt/static/assets/symbol/lifeboat--small-craft.svg.crswap' -> '/
  [0]   Users/Robert.Myers/coding/the-last-redoubt/public/assets/symbol/lifeboat--smal
  [0]   l-craft.svg.crswap'
  ```
- ✅ BUG sporadic startAnimationByMeta on click different part of do point
  - goLoop was triggered and was cancelling before startAnimationByMeta

- ✅ BUG: if end in doorway final navMeta should be final vertex
  - `nav andros '{ "x": 210, "y": 417.55 }'`
  - `nav andros '{ "x": 210, "y": 418 }'` 👈 just inside
- ✅ BUG: if end in doorway and turn around, FOV doesn't change
  - because `enter-room` not fired on way back
  - because on way into room we dropped the final point in doorway

- BUG should not be able to tab into Terminal whilst disabled
- BUG? saw npcs.playerKey set null on multi spawn?
  - Possibly HMR issue
- BUG move/resize circle decor all at once?
- BUG should not be able to open door through wall (e.g. toilet stateroom 12)
- BUG should not be able to spawn under door (from offmesh)

- try support hair custom hair
  - base characters will need to be bald
- ❌ `goLoop` -> `walkLoop`
- svg tags foo=bar become meta { foo: JSON.parse('bar') }
- sit has mask
- hide isolated hull doors touching edge geomorph

- useGeomorphs supports HMR?
- HMR issue ongoing processes with stale code
  - e.g. floor-graph.js
- update gatsby plugins to get source maps working?
  - maybe need more transpilation?
- navmesh accounts for closed doors
  - should fix double-door issue
- source map issue with jsx?
- tabs tabindex outline does not include controls
- Better approach to debug logging?
- HMR floor graph findPath propagates to ongoing processes?
- ❌ try pause/resume npc on click head
- ❌ can only directly spawn off-mesh when closer than closest stand point

- ✅ BUG lookAt can over-turn (now using Web Animations API)
- ✅ prevent crash on `$( npc get andros )`
- 🚧 BUG (possibly HMR) gm 101 saw light initially coming thru door
- ❌ BUG? saw pause/resume walk issue towards end
- BUG multiple prompts `$ $`
- rewrite use-geomorphs?
  > would like to refetch geomorph json without restarting
- consider behaviour when manually kill a pipe-child
- high-res unlit drawRects (currently canvas is half size)
- handle js transitionOpacity() or startAnimation() while paused?

- ✅ BUG raw-loader edit resets --npcs-debug-display
  - profile was being re-run, so `npc config debug` toggled
  - used `npc config '{ showIds: true, debug: true }'` isntead

- ✅ HMR npc config css var reset issues
  - ✅ npc debug circles became invisible 
  - ✅ roomIds from DebugWorld become invis 

- ✅ `<NPC>` supports HMR i.e. manually within useStateRef

- ✅ review how `relate-connectors` extends visible rooms
  - ✅ rather explicit but probably right
  - document what is going on
  - can show lights/connectors in GeomorphEdit

- `<Doors>` are slightly offset from underlying door in PNG
- split hull doors into two
- can specify door as `split`

- ❌ Synfig https://www.synfig.org/
  - ✅ Download and Install
  - ✅ Watch a tutorial
    > https://www.youtube.com/watch?v=5B_Aok26LKc&ab_channel=TurtleArmyJess
  - ✅ Remake walk cycle (first-npc.svg)
    - ✅ cut guard1_walk using https://ezgif.com/sprite-cutter
    - ✅ make first two frames
    - ✅ review and refine 1st 3 frames
    - 4th ✅ 5th ✅ 6th ✅
    - ✅ refine
    - 7th ✅ 8th ✅ 9th ✅ 10th ✅
    - ✅ render frames using CLI
      - ❌ try adding {...}/Resources/bin to PATH
      - ✅ try `brew install synfig`
        - `synfig --help` worked
      - ✅ try rendering via CLI
        - https://wiki.synfig.org/Doc:Synfig_CLI_Syntax
        - `synfig first-anim.sifz -t png-spritesheet -o my-test.png`
      - ✅ render a frame range (first 3 frames)
        - `synfig first-anim.sifz -t png-spritesheet -w 256 -h 256 -q 1 -a 3 --begin-time 0f --end-time 2f -o my-test.png`
    - refine
      - ✅ bevel layer
      - ears ✅ face ❌ (use bevel)
      - ❌ thumbs
      - ❌ foot shine
    - ✅ drop shadow
  - ✅ add a sitting frame
  - ✅ can move keyframes https://forums.synfig.org/t/moving-keyframes/2184
  - ✅ try `idle-breathe` via bones
    - ✅ rig: head -> neck -> {l,r}shoulder (neck for head motion)
      - https://www.youtube.com/watch?v=LTlI7C0VyRc&t=38s&ab_channel=MedEdAnimation
      - breathe in/out
  - 🚧 idle-breathe sans skeleton deformation
    - ✅ head tilt back + chest expand + shoulders lift/back
    - play it somehow
    - `animation-direction: alternate;`
    - better integration

- ✅ auto-min spritesheet/geomorph/etc PNGs
  - e.g. `pngquant --quality=80 -f first-human-npc--walk.png` 186k -> 44k
  - ✅ minify-pngs uses pngquant
  - ✅ pngs-to-webp script
  - ✅ minify-pngs has options to add webp
  - ✅ spritesheets auto-minified
  - ✅ on render geomorph auto-minify png and generate webp
  - ✅ on bake-lighting geomorph auto-minify png and generate webp
  - ✅ spritesheet use webp with png fallback
    - ✅ `<NPC>` has `webp` or `no-webp` class
    - ✅ modify npcs-meta.json CSS
  - ✅ geomorphs use webp with png fallback

- can specify npc filter e.g. `sepia(1)`
- ✅ strategy for prefetching spritesheets

- watch synfig files and re-render?

- 🚧 BUG: Error: ENOENT: no such file or directory, lstat '.../static/assets/geomorph/g-302--xboat-repair-bay-fs8.png.tmp'
  - in dev on-change file e.g. edit symbol
  - try upgrade gatsby

- 🚧 Collision prediction: _moving circle_ vs _static angled rect_
  - mdx description of simplified algorithm
    > angled-rect vs axis-aligned square (induced by npc circle)
  - hook up to decor `rect` somehow
    - ✅ BUG decor `rect` transform gets stuck 
    - ✅ decor `rect` supports angle?
    - can mark decor `circle` for collision-prediction
    - can mark decor `rect` for collision-prediction

- 🚧 chrome (clip-path) flicker on fast zoom?
  - ✅ @desktop removing CssPanZoom grid fixed it?
  - 🚧 @mobile problem persists
    - not clip-path specific
    - zoom smooth improved by removing .shade
  - @desktop again
    - shitty fix is `will-change: contents` in .panzoom-scale

- should tracking camera stop when click outside navmesh during walk?

- 🚧 Adjust Home Page
  - ❌ GIF demo of CLI
  - ✅ Video demo of CLI
    > `ffmpeg -i 'Screen Recording 2022-11-06 at 17.00.40.mov' -an -filter_complex "[0:v] fps=20,scale=600:-1" -b:v 0 -crf 25 output.mp4`
  - ✅ Redo video demo of CLI with sound
    - ✅ 1st test
      > `ffmpeg -i 'Screen Recording 2022-11-19 at 14.16.37.mov' -ac 2 -filter_complex "[0:v] fps=20:-1" -b:v 0 -crf 25 cli-frontpage-test.mp4`
      > 329Mb -> 20Mb
      > https://youtu.be/iohh0Glruis
    - ✅ 2nd test
      - `ffmpeg -i 'first-cli-draft.mov' -ac 2 -filter_complex "[0:v] fps=20:-1" -b:v 0 -crf 25 first-cli-draft.mov.mp4`
      - 13:09s `44M  7 Dec 10:48 first-cli-draft.mov.mp4`
  - 🚧 Redo video demo again (more focus)
    - ✅ first-cli-video-try-1
    - use Ctrl+L next time
  - ✅ Adjust textual copy, emphasising "canonical UIs":
    - POSIX CLI
    - Browser devtool  
  - 🚧 Video demo of `World` CSS/DOM
    - ✅ Far too complex: need a simplified overview
    - ✅ Clearer second attempt but still too complex
- 🚧 Adjust Intro
- ✅ symbols have thinner doors
  - ✅ work through 301
  - ✅ work through 101
  - ✅ work through 302
  - ✅ work through 303
  - ✅ work through 102
- 🚧 symbols have ui points

- BUG unseen windows should be totally dark
- 303: WARN doorIds lacking exactly 2 nav nodes: 5 (resp. counts 0)
- ✅ browserslist: try adding old safari version
  - https://demo.lastredoubt.co/
- Can sit/stand toggle
- Decor rect collision prediction

- 🚧 Performance
  - ✅ Remove YouTube from SSR via facade
  - ✅ Try upgrading Gatsby
  - ✅ Remove parse5/cheerio from main bundle
  - ✅ Remove unused mdx from main bundle
  - 🚧 Smaller main bundle
  - remark/rehypePlugins ?

- Connect Dev Env to Chrome (breakpoints)
- Make homepage CSS video 

- 🚧 NPC idle can be sitting or standing
  - ✅ `npc.anim.spriteSheet` can be `sit`
  - ✅ gm 301 has points tagged `point ui {sit,stand,lie}`
  - ✅ support decor point
  - ✅ decor point can be clickable with callback
  - ✅ decor point mutates with devtool interaction
  - ✅ decor point callback can log to terminal
  - ✅ shell func `roomUi` add/removes ui points in player's current room
  - ✅ `roomUi` -> `localDecor` wraps NPCs toggleLocalDecor
  - ✅ `localDecor` shows initially and hides on termination
  - when `idle` can change to `sit`

- ✅ anim.sprites also has initial delay to preserve sprite duration modification
- Safari: Door collision bug
  - ✅ Should not start animation before initial cancel
  - ✅ Cancel track on collide door should not be jerky
- Safari: Jerky zoom issues
  - incorrect screen clipping?
  - e.g. zoom out then click walk


- 🤔 Persist npc config?

- ✅ Document npc vs line-seg collision
- ❌ Implement npc vs line seg collision predict
  - ✅ define NPC segs and show them via debug
    - ✅ defined via CSS
    - ✅ configuration induces CSS
    - ✅ fixed transform styles applied to individual divs?
  - ✅ can add segs/circles/paths (visible in DEBUG)
    - ✅ `npc decor {...}`
    - ✅ circle via styled div (not SVG)
    - ✅ segment via styled div (NEW)
    - ✅ path ~ div nodes with auto-redrawn path? 
    - ✅ circle/seg also mutate decor onchange via devtool
    - ✅ `npc decor foo` gets decor foo
    - ✅ support e.g.
      - `{ echo foo; echo bar; } | npc rm-decor`
      - `{ echo foo; echo bar; } | npc decor`
  - can add test seg e.g.
    > `npc decor '{ key: "bar", type: "seg", src: {"x":207.83,"y":384.43}, dst: {"x":227.83,"y":384.43} }'`
  - 🚧 translate textual algorithm into `predictNpcSegCollision`
  - test against manually placed segs
  - integrate into NPC vs Door collision prevention

- Recall how NPC vs Door intersection is currently computed
  - getNpcsIntersecting > circleIntersectsConvexPolygon
  - playerNearDoor > circleIntersectsConvexPolygon
  - ...
- ...
- Collision issue when initially start very close
  > e.g. just after collided

- Performance: hide `shade.PNG`s whilst zooming
- Migrate docs/commands.md from robmyers.github.io repo into EXAMPLES.md

- ✅ Create page /sketch
- ✅ Write some math markdown in /sketches
- ✅ Cleanup npc vs npc collision predict
- ✅ Can `click | nav andros | walk andros`
- ✅ Problematic case:
  - 2 NPCs head for same point in straight line
  - A arrives before B _without colliding_
  - Then: need to trigger another check for B
- ✅ Document npc vs npc collision quadratics in page /sketches

- Add grid back via lighting?
- ✅ Rename page stub as page preview
- Fix Tabs outline + Escape pauses?
  - In Desktop can press Esc whilst running a World

- Page stubs
  - ✅ Add preview to /intro/setup
  - ✅ /info/sketch -> /about
  - ✅ Add some content to /about
  - ✅ Add page /intro/js-cli
  - ✅ Add page /intro/ai-cli
  - ✅ Add some content to /intro/js-cli
  - ✅ Add some content to /intro/ai-cli

- 🚧 Finish 2-variable quadratic i.e. NPC intersects line seg
  - Write down solutions carefully

- 🚧 YouTube: lazy load
  - https://web.dev/iframe-lazy-loading/
  - Seems scripts are still being loaded

- ✅ BUG cannot get{Position,Angle} when tab hidden
  - Tabs now uses `visibility: hidden` instead of `display: none`
- ✅ BUG bridge window lighting
  - frosted windows should not contribute to light shade
- ✅ Center page when nav menu open and ≥ 1450px (?)
- ✅ BUG /test gm302 open door

- BUG anim.translate can be removed if don't use window for a while
  - `goLoop: walk: run: TypeError: anim.translate.addEventListener is not a function`

- Clarify strategy: if lights intersect use "light reverse" (?)

- ❌ BUG with history after following ext link?

- ✅ Clean and modularise NPC JSON imports
  - ✅ create service/npc-json
  - ✅ migrate previous approach
- ✅ Create 1 frame sit animation
- ✅ Can `sit` by applying class
- 🚧 Explain how and where spritesheet is changed
- Can change spritesheet from CLI e.g. `npc sheet andros sit`
- Improve sit animation

- ✅ Render a graphviz graph

- Avoid dup loaded components
- Fix Tab body lock when initially maximised
- ❌ Some graphs between early paragraphs
- Bigger white doors
- Better door collision detection
  - circle along line seg vs a door line-seg
  - perhaps quadratic in two variables?
- Remove rotation transition during walk, to fix web animations API polyfill

## Done

- ✅ redo geomorph layout syntax
  - ✅ GeomorphEdit remembers last selected
  - ✅ can specify { x, y, a?: 0 | 90 | 180 | 270, flip?: 'x' | 'y' | 'xy' } where { x, y } final topLeft
  - ✅ specifications take effect inside `createLayout`
  - ✅ support layout def "stacks" i.e. horizontal rows
  - ✅ only support horizontal rows
  - ✅ redo gm102 -- no need for rows, except where needed 
  - ✅ redo gm301
  - ✅ redo gm302
  - ✅ redo gm303

- ✅ BUG cancel during extendWalk is setting idle?
- ✅ BUG lifeboat--small-craft chairs missing?
- ✅ BUG tracking should stop when player stopped by door
  - `stopped-walking` not triggered on door collide?
- ✅ BUG tracking should pause when pause stationary player
- ✅ BUG track: panzoom-to / no-track alternation
- ✅ BUG manual panzoom (drag) + `view 1 1` causes jerk
  - maybe trackNpc confused by other panzoom?
- ✅ BUG tracking should stop when player looks during walk
  - because were manually panzoom via click

- ✅ `npc map {show,hide,show-for-secs}` only applies to labels

- ✅ BUG `track` jerky, particularly on mobile 😱
  - ✅ try use getCurrentTransform()
  - ✅ outer element for track only i.e. translation
    - ✅ looks good on mobile
    - ✅ fix worldPoint
    - ✅ fix manual zoom
    - ✅ fix animated pan/zoom
    - ✅ fix tracking i.e. not centered
    - ❌ fix cancel anim?
    - ✅ tracking should pause/resume
    - ✅ getComputedStyle is needed if we are currently following
  - ✅ verify works well on mobile

- ✅ on pause walking tracking player, permit pan
- ✅ fadeSpawn should face direction of spawn

- ✅ BUG ctrl-c failure while forcePaused
  - ctrl-c SHOULD override in this case
  - ✅ killProcess(process, SIGINT?)
  - ✅ npc.cancel(SIGINT) will override paused
```sh
$ walk rob $( click 1 )
$ click 1 | walk rob
$ nav rob $( click 1 ) | walk rob
```

- ✅ BUG
  - ✅ (1) npc paused with spriteSheet `walk` can be walked through
  - ✅ (2) on unpaused they walk on the spot...
  - REPRO walk into another npc, forcePause (1) then unpause (2)

- ✅ merge `walk2` into `controlNpc`
  - ✅ debug.addPath in `npc.walk` rather than `nav`
  - ✅ npc.extendNextWalk(points)
    - ✅ can add points to `npc.anim.nextVisits`
    - ✅ on add points compute next navPath + debug.addPath (current + future)
    - ✅ on finish walk, walk along nextWalk.navPath
    - ✅ cleanup
    - ✅ debug.extendPath rather than replace in extendNextWalk
    - ✅ npc.extendNextWalk NavOpts
      - npc.navOpts
  - ✅ merge into `controlNpc`
    - getting stuck sometimes
  - ✅ support immediate walk via longClick
  - ✅ merge into `walk` i.e. handle points as well as navPaths
  - ✅ remove `walk2`


- ✅ darker when paused but not forcedPaused
- ✅ fix stale CSS `paused` on unpaused npc
- ✅ `api.npcs.svc.foo` too verbose
  - now use `api.lib.foo`

- ✅ BUG jittery: saw cenScale 20
  - ℹ️ currently we "undo scale" by panZooming, which aggregates
  - ✅ instead, try WAAPI animating centered-zoom
  - janky zoom switching if zooming whilst walk stops
  - ✅ could we get away with a single el?!
    - WAAPI can combine with styles!
      > `$0.animate([{ offset: 0 }, { offset: 1, transform: 'scale(2)' }], { composite: 'accumulate', duration: 5000 })`

- ✅ try removing `centered-scale`
  - use `composite: 'accumulate'` for followPath
  - ❌ zoom switches between "pointer target" and "centre of screen"

- ✅ try `walk2` which "appends" navPath
  - ✅ basic functionality
  - ✅ fix `click 2 | walk2 --open rob`
  - ✅ ensure futurePoints are navigable
  - ✅ show navpath(s)
  - ✅ tracking does not stop on click

- ✅ zooming doesn't break tracking
  - ❌ try `translate(...) scale(...)` using "translateRoot"
  - ❌ try swapping translateRoot and scaleRoot
  - ✅ outer div "centered-scale"
  - ✅ check things work whilst centered-scale is zoomed
    - ✅ fix manual panzoom
    - ✅ fix `click` whilst zoomed
    - ✅ fix animated panzoom `view`
  - ✅ collapse translate/scaleRoot
  - ✅ commit CssPanZoom WIP
  - ✅ clean CssPanZoom
  - ✅ state.cenScale
  - ✅ while followPath, panning has no effect
  - ✅ while followPath, zooming changes cenScale
  - ✅ isFollowing via animation "id" (more like a label)
  - ✅ BUG walk, re-walk, zoom
    - after re-walk, seems we are no longer centre-zooming
  - ❌ clearing state.start.client{X,Y} breaks drag-click door open
    - already expect "clean clicks"

- ✅ BUG pipes: `expr null | map 'x => x'` empty
  - use `api.eof := Symbol.for("EOF")` instead of `null` for EOF

- ✅ mobile central-zoom via pinch
- ✅ clamp product of scales
  - ℹ️ so can always zoom out after leaving follow cam
- ✅ track panZoom resets zoom i.e. cancels cenScale

- ✅ avoid too many processes in listing for pause/resume,
  - ❌ processes pass down "names"
  - ✅ shorter `ps -s` 
  - ✅ `ps` hides links when leader has descendant leader

- ✅ pause/resume click for all npcs
  - ✅ shell function pausableNpcs
  - ✅ all NPCs have clickable head
  - ✅ careful about controlNpc (try verbose)
  - ✅ clarify isPaused vs manuallyPaused
    - ✅ manuallyPaused -> forcePaused
    - ✅ clarify isPaused()

- ✅ clarify various types of pausing
- ✅ `npc config verbose` to show errors in loops

- ✅ fix `npc rob do $( click 1 )` on enter/leave do point
  - ✅ cannot go thru walls
  - ✅ on/off mesh spawn too
  - ❌ maybe should be long _press_ not click

- ✅ fix `nav rob $( click 1 ) | npc rob walk`
- ✅ fix `nav rob $( click 1 ) | npc rob lookAt`
- ✅ permit `npc rob walk - '{ doorStrategy: "open" }'`
  - ℹ️ i.e. stdin represented via hyphen
  - ✅ `npc: run: paused: cannot cancel`
  - ✅ move "selector" out of getNpc
  - ✅ cleaner approach
-  ✅ permit stdin elsewhere e.g. `click | npc rob do - '{ fadeOutMs: 2000 }'`
- ✅ `walk` uses `eagerReadLoop` like `npc rob walk`
- ✅ `look {npcKey}` is `npc {npcKey} lookAt`

- ❌ support `click | filter meta.npc | world '(w, p) => w.npcs.getNpc(p.meta.npcKey).pause()`
  - ❌ could set value processApi.ctxt via option `run --ctxt="(processApi) => foo" ...`
    - ℹ️ ugly syntax `map '(input, { ctxt }) => ...'`
  - ℹ️ use `click | map ...` instead, with easier access to world

- ✅ BUG `walk` should pause
```sh
npc rob pause
nav rob $( click 1 ) | walk --open rob
# click a navigable point, then try to ctrl-c
```
- ✅ BUG could not ctrl-c `nav rob $( click 1 ) | walk --open rob` after unpausing
  - had to wait for walk to finish

- ❌ paused npc should error when `do`/`go`/`look`?
  ℹ️ if we want rob to look/npc/nav/walk,
    `kill --STOP {pid}` the controlNpc process,
    or use `ps` buttons (more convenient)
  - ✅ cannot cancel whilst paused
  - ✅ cannot walk whilst paused
  - cannot look whilst paused
  - cannot do whilst paused
  - cannot spawn whilst paused

- ✅ `npc rob do $( click 1 )` should open door
- ✅ `nav rob $( click 1 ) | walk rob` should pause on pause tabs

- ✅ easier access to world in `map`
  - `env.CACHE_SHORTCUTS` is `{ w: 'WORLD_KEY' }`
  - processApi proxy provides `api.w`

- ✅ raw-loader game functions handle npc (manual) pausing
  - ✅ `look rob $( click 1 )`
    - ℹ️ but not `npc rob look $( click 1 )` which directly invokes function
  - ✅ e.g. `nav rob $( click 1 ) | walk rob`
  - ❌ spawn
  - ✅ `npc rob cancel`
  - ✅ `npc do rob $( click 1 )`
  - ✅ final check through examples

- ✅ BUG local variables not working inside nested functions?
```sh
foo () {
  local bar
  bar="Whatever"
  echo "level 1: $bar"
  baz() { echo "level 2: $bar"; }
  baz
}
foo
```
- ✅ remove "__TEMP_ARG_1" approach in `world` and `gm`
  - `local` variables not seen inside pipe-child

- ✅ `npc look-at rob $( click 1 )` -> `npc rob lookAt $( click 1 )`
- ✅ handleLongRunningNpcProcess kills on `removed-npc`

- ✅ js functions throw on `npc.manuallyPaused`
  - 🤔 cleanup `cancel` should not run if manually paused?
  - ✅ cancel
  - ✅ walk
  - ✅ look
  - ✅ do
  - ✅ spawn

- ✅ `npc cancel rob` -> `npc rob cancel`
- ✅ `npc pause rob` -> `npc rob pause`
- ✅ `npc resume rob` -> `npc rob resume`

- ✅ `npcs.npcActDo` -> `npc.do`
  - ✅ `npc rob do $( click 1 )`
  - ✅ `click | npc rob do`
  - ✅ removed `npc do`

- ✅ `npcs.walkNpc` -> `npc.walk`

- ✅ BUG ctrl-c `click 1` not releasing click
- ❌ BUG `click | look rob` or `lookLoop rob` multi-click jerky
  - no repro
- ✅ spawn ignores manuallyPaused

- ✅ handleLongRunningNpcProcess provides api which handles pausing
- ✅ handleLongRunningNpcProcess provides proxied `npc`
- ✅ `npc rob ...` or `npc get rob ...` uses proxied `npc`

- ✅ add pause/resume/kill links inside `ps`
  - ✅ add working buttons
  - ✅ kill button kills, clears links, updates line in place
  - ✅ clean `ps`
  - ✅ pause button pauses
  - ✅ pause/resume button toggles in place
  - ✅ resume button resumes

- ✅ `ps` no buttons for `0` or pipeline parent

- ✅ cleanup commands/shell-fns
  - ✅ controlNpc avoid try-catch + clean
  - ✅ panZoom.pointerUpExtras -> clickIds
  - ✅ remove Promise.race
  - ✅ remove opts
    - ✅ remove `nav --exactNpc` (nav always relaxed about npcKeys)
    - ✅ remove `nav --preferOpen` (nav prefers open doors by default)
    - ✅ remove `nav --to`
    - ✅ remove `nav --safeLoop`
    - ✅ remove `npc --safeLoop`

- ✅ cleaner api.info

- ✅ BUG failed collision while `rob` paused and `nav foo rob | walk foo`
```sh
# REPRO
spawn rob {"x":308.16,"y":426.41}
spawn foo --zhodani '{ x: 231.23, y: 319.37 }'
# walk towards behind foo and pause near corner
nav foo rob | walk foo
# observe collision failure
```

- ✅ controlNpc combines player ui i.e. look/walk/do/think/fadeSpawn
  - ✅ format `click | run '...'`
  - ✅ abstract `parsePoints`
  - ✅ `declare -f goLoop`
    ```sh
    click |
      filter '({ meta }) => meta.nav && !meta.ui && !meta.do && !meta.longClick' |
      nav --safeLoop --preferOpen --exactNpc ${1} |
      walk ${1}
    ```
  - ✅ `declare -f lookLoop`
    ```sh
      click | # do not look towards navigable or doable points
        filter 'x => !x.meta.nav && !x.meta.do' |
        look ${1}
    ```
  - ✅ `declare -f doLoop`
    ```sh
    click |
      filter 'p => p.meta.do || p.meta.nav || p.meta.door' |
      npc do --safeLoop ${1}
    ```
  - ✅ `declare -f thinkLoop`
    ```sh
    click |
      filter 'x => x.meta.npc && x.meta.npcKey === "'${1}'"' |
      run '({ api, home }) {
        const { fov } = api.getCached(home.WORLD_KEY)
        while (await api.read(true) !== null)
          fov.mapAct("show-for-ms", 3000)
      }'
    ```
  - ✅ clean
  - ✅ fadeSpawn
    ```sh
    while true; do
      longClick 1 | filter meta.nav |
        npc rob fadeSpawnDo
    done
  - ✅ fadeSpawn restricted by distance/line-of-sight
  ```

- ✅ mobile even more zoomed out
- ✅ avoid hull doors intermediate black poly
  - ✅ try ignore small polys
- ✅ BUG rob and foo should have different navpath
  > `while true; do nav foo rob | walk --open foo; done`

- ✅ controlNpc supports re-enter navmesh when off-mesh AND not at do-point

- ✅ controlNpc pauses on click npc
  - ✅ "manually" pause npc
  - ✅ paused npc grayscale
    - ℹ️ uses css class without trigger `<NPC>` render
  - ✅ paused npc prevents other controls
  - ✅ controlNpc shows map on longClick click npc

- ✅ pipe semantics and lastExitCode
  - ✅ cleaner pipe semantics
  - ✅ fix `( false; echo ${?} )`
  - ✅ every process sets lastExitCode
  - ✅ lastExit: { fg, bg }
  - ✅ $? is foreground/background depending on ctxt

- ✅ BUG final pasted line was overwriting,
  in fact xterm.writeln is not synchronous
```sh
# paste this with trailing newline
# and observe no `foo`
echo foo
 
```

- ✅ BUG lastExitCode
  - ✅ `false; echo $?` should have exit code 1
  - ✅ `echo | false; echo $?` should have exit code 1
  - ✅ `false | echo $?` then `true; echo ${?}` one-step-behind
  - ✅ on ctrl-c profile `true; echo $?` should not initially have exit code 130

- ✅ BUG dies early:
  - ✅ `while true; do longClick 1 | filter meta.nav | npc rob fadeSpawnDo; done`
  - ✅ `while true; do longClick 1 | map meta; done`
  - ✅ `while true; do click 1 | map meta; done`
    - next iteration starts BEFORE we kill pipe-children!
    - solved by setting ppid as pid of next spawned process,
      as opposed to ongoing parent process inside while loop

- ✅ take 1 | run '({ api }) { throw api.getKillError(); }'
  - `run '...takeDef..' $@` is overwriting lastExitCode with `0`

- ✅ use pgid in pipes i.e. last pipe-child pid

- ✅ BUG `return` not working
  ```sh
  foo () {
    return
    echo foo
  }
  ```

- ✅ strategies for escaping homing NPC
  - ✅ nearby NPC should not prevent off-mesh spawn to navmesh
    - `npcs-collide` should not cancel non-walking npcs
  - ✅ long click to spawn nearby
    - ✅ `click [n]` provides `meta.longClick` boolean
    - ✅ `click --long [n]` only triggers on long click,
       in which case it overrides `click [n]`
    - ✅ `click --long 1` does not override short clicks
    - ✅ remove option --long, using `meta.longClick` instead
    - ✅ can spawn on long click:
      - `click | filter meta.longClick | map 'x => ({ point: x, npcKey: "rob" })' | spawn`
    - ✅ implement `filter --take=n` so can:
      > `click | filter meta.longClick --take=1`
    - ✅ move `filter --take` -> `take`
    - ✅ fix pipe semantics
    - ✅ implement shell function `take [n]`
    - ✅ implement shell function `longClick [n]`
      ```sh
      longClick () {
        click | filter meta.longClick | take $1
      }
      ```
    - ✅ fix pipe semantics again i.e.
      > on final pipe-child terminate,
      > we should NOT kill the process group,
      > we should ONLY kill the other pipe-children
    - ✅ can fade spawn on long click
      - `npc rob fadeSpawnDo $( longClick 1 )`
      - `while true; do npc rob fadeSpawnDo $( longClick 1 ); done`
      - restrict to navigable
        ```sh
        while true; do
          longClick 1 | filter meta.nav |
            npc rob fadeSpawnDo
        done
        ```
      - alternatively
        ```sh
        while true; do
          longClick 1 >clicked
          test $( clicked/meta/nav ) &&
            npc rob fadeSpawnDo $( clicked )
          rm clicked
        done
        ```
    - ✅ fix final extra loop on ctrl-c
      ```sh
      while true; do
        longClick 1 >clicked
        test $( clicked/meta/nav ) &&
          npc rob fadeSpawnDo $( clicked )
      done
      ```
    - ℹ️ no issue when we run as a background process

- ✅ redo pipe semantics
  - 🤔 why throw ShError(`pipe ${i}`, node.exitCode) on non-zero-exit pipe-child?
  - ✅ why does `take 3 | true` not terminate `take 3` immediately?
    - `take 3` was "reading" from TTY,
      `ttyShell.io.writeToReaders({ key: 'send-kill-sig' })` worked
- ✅ various examples demonstrating pipe semantics
  - ✅ example where first pipe child throws killError
  - ✅ example where last pipe child throws killError

- ✅ fix remaining pipe semantics examples
  - ✅ `while true; do longClick 1; echo foo; done` on ctrl-c no foo
  - ✅ `while true; do longClick 1; test $( not/found ); done`
  - ✅ non-zero exit code not present in some cases

- ✅ BUG goLoop should not fail:
```sh
goLoop: walk: run: Error: start of navPath blocked
```

- ✅ BUG "nav | walk" loop should not fail
  - invert `--nearNpc` -> `--exactNpc`
  - off-mesh nav-mesh click should fade-spawn
```sh
$ while true; do nav foo rob | walk --open foo; done
nav: run: Error: npc rob outside navmesh: {"x":-173.71,"y":1113.42}
# rob apparently was outside navmesh
nav '{x: -219.66, y: 1048.12}' '{x: -159.19, y: 1121.08}' | walk rob
```

- ✅ debugPlayer does not show frustum (but debug does)
- ❌ geomorph PNGs navmesh higher contrast?
  - use geomorphFilter instead

- ✅ GeomorphEdit
  - ✅ fix redraw
  - ✅ improve perf
  - ❌ support "groups" in geomorph-layouts

- ✅ move DecorPath to DebugWorld

- ✅ gm 102: broken nav i.e. geomorph with 2 disjoint navmeshes
  - `spawn rob {"x":-904.18,"y":1257.07}`
  - ✅ seems `id` is reset over different groups
  - ✅ hull door connectivity still broken
    - gmGraph.findPath dstNode wrong, because both 102 navmeshes
      have rect which contains point...

- ✅ light issue when spawn into room with diagonal door
  - e.g. `spawn rob {"x":-1004.11,"y":1003.39}`

- ✅ npc.canSee(npcKey)
  - ✅ `npc rob canSee foo`
  - ✅ if in same room
  - ✅ if in adjacent room
  - ❌ if have shared adjacent room
  - ✅ display view frustum (45 deg) fov-indicator via background-image
  - ℹ️ Player's FOV should contain view frustum
  - ❌ FOV door offset changes when inside door sensor?
    - ❌ gm.roomOverrides at level of GeomorphDataInstance?
  - ✅ can test if point lies in view frustum (triangle)
    - api.npcs.inFrustum(src, dst, srcRadians, fovRadians = Math.PI/4)
    - npc.inFrustum
  - ✅ can test if `same-room` or `adj-room` or `rel-room`,
    providing open/open-related shared doors too
    - ✅ `world gmGraph.getRoomsVantages "$( npc rob gmRoomId )" "$( npc foo gmRoomId )"`
    - gmGraph.getRoomsVantages(gmRoomId, other, requireOpenDoors = true)
    - output will be used by raycast stage
  - ✅ raycast stage: `api.npcs.canSee(src, dst)` for points src, dst
    - ✅ with {src,dst}?.meta?.{gmId,roomId}
    - ✅ `world npcs.canSee "$( click 1 )" "$( click 1 )"`

- ✅ gmRoomGraph to simplify many computations
  - ✅ create it
    - whose nodes are `gmRoomId`s
    - whose directed edges are lists of `{ gmId, doorId, [adjGmId], [adjDoorId]  }`
    - built via `gm[i].roomGraph` + gmGraph
  - ✅ fix connection error
    - ℹ️ `world gmGraph.findRoomContaining $( click 1 )`
    - 303 room 25 had self-room-door
  - ✅ also provides "relate-connectors" over GmDoorIds
    - 101 has relation door -> window via "office 26"
    - respects identified hull doors
  - ❌ also provides "parallel-connectors" over GmDoorIds
    - can hopefully just use each `gm.parallelDoorId`
  - ✅ 301 has extra relation so FOV can see:
    > toilet -> stateroom -> corridor -> stateroom
  - ✅ fast (gmId, roomId) -> gmRoomGraph node
  - ✅ migrate getGmRoomsDoorIds to gmRoomGraph.getAdjDoorIds
  - ✅ fix FOV issue after adding new relation to 301
    - we restrict lights by their direction
  - ✅ migrate getRoomsVantages to gmRoomGraph.getVantages
    - ✅ `world gmRoomGraph.getVantages "$( npc rob gmRoomId )" "$( npc foo gmRoomId )"`
  - ✅ getGmRoomsRelDoorIds -> gmRoomGraph.getRelDoorIds
    - needs implementation
    - prohibit relations which jump over dstRm

- ✅ Grid for room polys
  - ✅ precomputed per geomorph
  - ✅ used when search for room containing point
  - ✅ `click` ensures `meta.{gmId,roomId}`

- ✅ replace lightPoly `direction` with simplified area.poly
  - ℹ️ room before light replaced by "envelope"
    i.e. 5gon extending door backwards to cover the light

- ✅ precompute relDoorId
  - ✅ move relDoorId into geomorph.json computation
  - ✅ move parallelDoorId into geomorph.json computation
  - ✅ R(doorId, otherDoorId) has behind: [boolean, boolean] aligned to doorId roomIds
  - ✅ long relations (3 or more related doorIds) induce depIds for intermediates
    - also avoid dup relations

- ✅ BUG: FOV: long relation when intermediate door closed
  - either "choose correct polygon" or prevent relation
  
- ✅ BUG with hull doors timeout: might need to clear both

- ✅ BUG npc navigated off-mesh somehow
```sh
# REPRO
world npcs.isPointInNavmesh {"x":-74,"y":362.47}
# true
spawn rob {"x":-74,"y":362.47}
nav rob $( click 1 ) | walk rob
# nav: run: Error: getLocalNavPath: no path found: {"x":-74,"y":362.47} --> {"x":-85.83,"y":364.97,"meta":{"world-root":true,"targetPos":{"x":-27.1,"y":279.05},"nav":true}}
```
  - decided ok to fallback to centroids of nearby nodes (via grid),
    GIVEN we guard by navPoly containment test

- ✅ builtin `say`
  - ✅ can choose voice `say --v="Google UK English Female" {1..5}Hello`
  - ✅ can list voices `say --v=?`
  - ✅ can ctrl-c
  - ✅ can pause/resume
  - ✅ can `echo foo{1..5} > /dev/voice`

- ✅ clean `computeDoorViewArea` etc.
- ✅ sealed doors are red (they needn't be hull doors)
- ✅ Boxy SVG issue i.e. rotated rects not parsed
  - internal rep change: need to add transform-origin

- ✅ fix peek i.e. need extra "parallel doors" in larger FOV

- ✅ rect colliders are not being transformed by parent geomorph
- ✅ 302 has peek-view flicker when two doors open and move between sensors
  - ✅ parallel doors should be double-doors (remove non-example in 101)
  - ✅ possibly never properly transformed rect colliders?
  - ✅ parallel doors have rect sensors?

- ✅ FOV rethink:
  - ❌ FOV always includes "raycast" from stationary Player through open doors/windows
  - ❌ doorViewPosition could always be Player position
  - ❌ show all of nearby rooms i.e. no raycast
  - ℹ️ can think of closeDoorIds as "peeking"
  - ✅ clean decor-collide events
    - ✅ `npc events | filter /decor-collide/ | map meta`
    - ✅ spawn in -> enter
    - ✅ spawn out -> exit
    - ❌ exit room -> exit
    - ✅ enter room -> enter, exit
    - ✅ can start-inside if start in door
    - ✅ spawn into doorway -> enter
    - ✅ spawn out-of doorway -> exit
  - clarify navMetas with index -1
  - ✅ `fov.nearDoorIds` is Player's intersecting door sensors
  - ✅ `fov.nearDoorIds` induces wider FOV through respective doors
    - ✅ `decor-collide` triggered for first spawn
    - ✅ initial spawn not setting fov.nearDoorIds
      - ℹ️ because we `spawn rob ${point}` before `npc set-player rob`
      - ✅ `npc set-player rob` should set `fov.nearDoorIds`
    - ✅ get hull doors working too
    - ✅ npc set-player '' error should propagate
    - ✅ trigger update on enter/exit door sensor
  - ✅ BUG hull doors FOV not shown from one side
    - ✅ for hull doors (one particular side), view offset has wrong direction 
  - ✅ BUG hull doors nearDoorIds FOV flicker
    - ℹ️ hull doors trigger updateClipPath twice via 2 doors (open/close)
    - ℹ️ happens when enter doorway, despite no collider exit

- ✅ `spawn foo --class=zhodani $( click 1 )`
- ✅ `spawn foo --zhodani $( click 1 )`
- ✅ andros -> rob
- ✅ `npc {npcKey} [selector]` selector can be string, e.g.
  - `npc rob classKey`
- ✅ `npc {npcKey} [selector]` selector string invokes function
  - `npc rob getPosition`
  - `npc rob getAngle`
- ✅ BUG nav --nearNpc in other room

- ✅ `npc {npcKey} [selectorStr] [fnArg]*`
  - `npc rob setSpeedFactor 1.2`
  - `npc rob hasDoorKey 0 2`
  - `npc {npcKey} anim.speedFactor`
  - `npc {npcKey} anim.path`
  
- ✅ `map` deep string selector, invoke fn, pass args
```sh
echo foo | map length
echo "(that's what I said)" | map slice 1 -1
world doors.toggleLock 0 8
gm 0 matrix
gm 0 getHullDoorId 5
```
- ✅ builtin `shift [n]`
- ✅ BUG saw Geomorphs drawRectImage without `imgEl`
- ✅ BUG relate-connectors should traverse geomorphs e.g. 302
  - ✅ handle hull door extensions properly: clip other geomorph
  - ✅ other hull door should respect relation
    - `adjAreas` handles `R(doorId, hullDoorId)`
    - ✅ handle `R(hullDoorId, otherGmDoorId)` explicitly

- ✅ clean/improve choice text in first demo
  - ✅ add tty link to early on page #aside--can-pan-zoom-tabs
  - ✅ session can see Tabs id i.e. `DOM_ID`
- ✅ link labels must have spaces: `[ continue ](-)`
  > to avoid viewing e.g. arrays as links
- ✅ non-iris doors slide
- ✅ support `nav --nearNpc`

- ✅ fix `nav --nearNpc foo andros | walk --open foo`
  - ✅ fix `nav` i.e. `gmRoomIds": {"NaN": {"gmId": 1, "roomId": 1}},`
  - ✅ stopped at a door again: `decor.byRoom[gmId][roomId]` empty
    - `decor.ensureByRoom(gmId, roomId)` invoked whenever add/remove/set decor
    - we should invoke it on enter room?
    ```sh
    spawn foo zhodani {"x":325.13,"y":544.62}
    spawn andros {"x":625.49,"y":1463.85}
    nav --nearNpc foo andros | walk --open foo
    ```

- ✅ BUG doors closing whilst World paused
- ✅ BUG doors closing too early after manually open/closed

- ✅ npc.service -> singleton (rather than `import *`)
- ✅ clean `npc`
  - ✅ move `npc events` to npcService
  - ✅ typed approach to `npc` normalizeNpcCommandOpts
       > `normalizeNpcCommandOpts` outputs `NPC.NpcAction`?

- ✅ fix `npc map {action} [ms]` plus `ms` -> `secs`
- ✅ BUG `npc look-at andros $( click 1 )` should support Ctrl-C

- ✅ BUG `npc set-player andros` case where lights are not updated
```sh
# REPRO in room with door with light going outwards 
npc set-player
# open door and go thru, wait for it to shut
npc set-player andros
# observe light coming thru door
```

- ✅ clean NPC shell functions
  - ✅ doLoop
  - ✅ thinkLoop

- ✅ DecorGroup cannot contain another DecorGroup
  - ✅ so `descendants` isn't necessary
  - ℹ️ could still support multiple groups per room defined in svg

- ✅ `decor` -> `decor: { decorKey, type, meta }` in decor-collide
- ✅ rename navPath.partition -> navPath.edgeNodeIds
- ✅ npc cannot open locked door
- ✅ npc can open locked door with key

- ✅ simplify nav path gmRoomIds
  - ✅ only store changes
  - ✅ set inside npc and lookup from there
  - ✅ hookup to npc api

- ✅ unify api.doors
- ✅ BUG strange early `track` during CssPanZoom initial panzoom

- ❌ move --tryOpen to `walk`?
- ✅ `nav --closed={weight}` weights _closed_ doors
- ✅ `nav --locked={weight}` weights _locked_ doors (open or closed)

- ✅ locked doors are indicated as such
- ✅ `walk` opts reflect `doorStrategy`, forwarded to `followNavPath`
- ✅ understand `npcs.config.scriptDoors` and possibly remove
- ✅ remove getNpcGlobalNav

- ✅ competing notion of gmRoomId
  - `[gmId, roomId]` --> `{"gmId":0,"roomId":2}`

- ✅ `nav --name` induces named DecorPath (default `navpath-default`)
- ✅ `nav {npcKey}` has default name `navpath-${npcKey}`
- ✅ `npc decor ${navPath}` induces named DecorPath

- ✅ support `nav {p1} ... {pn}`
- ✅ `nav` arg can be point or npcKey
- ✅ support `nav {p1} ... {pn}` with piping in
- ✅ BUG interference between `click | nav ...` and `nav $( click 3 ) | walk --open andros`
  - bad `nav $( click 3 ) | walk --open andros`
  - bad `nav $( click 2 ) $( click 1 ) | walk --open andros`
  - good `nav $( click 1 ) $( click 1 ) $( click 1 ) | walk --open andros`

- ✅ BUG doors sometimes not opening during `walk --open`
  - navpath concat issue?
  - door closing early?

- ✅ BUG `goLoop` dies on leave off-mesh point (e.g. get out of chair)
  - ignore thrown errors if piping and `nav --safePipe`

- ✅ BUG with navPath concatenation
  > `nav '{ x: 151.52, y: 238.77 }' '{ x: 209.61, y: 366.04 }' '{ x: 272.57, y: 229.39 }' | walk --open andros`

- ✅ implement `walk --open`
  - ✅ walk `--open` subscribes
    - ℹ️ moved to use-handle-events via npc.anim.walkStrategy
  - ✅ doorSensors doorId is wrong
  - ✅ walk `--open` detects approach/leave door using door sensors
  - ✅ might approach next door before leaving previous?
  - ✅ BUG sometimes doorSensor `enter` not triggered
    - decor grid
  - ✅ fix hull doors
  - ✅ walk `--open` changes npc speed
    - npc slows down when "approaching door"
    - npc speeds up when enter room
- ✅ remove `--tryOpen`

- ✅ BUG resumed process `track` out of sync

- ✅ BUG navpath malformed
```sh
# repro (spawn without protect state.isPointSpawnable)
spawn foo '{ x: 219.54, y: 346 }'
nav foo '{ x: 291.34, y: 406.76 }' | walk foo
```
- bad string-pull: on border of "doorway triangle"?
- another example occurs in doorway (hopefully fixed)

- ✅ BUG while not always cancellable?
  - bad: `while true; do walk andros $navPath; done`
  - good: `while true; do navPath | walk andros; done`
  - difference: pipeline triggers throw of killError

- ✅ BUG collision miss on alternating iterations of:
  - bad: `while true; do walk andros $navPath; done`
  - good: `while true; do walk andros $navPath; sleep 1; done`
  - ℹ️ npc.cancel had late this.clearWayMetas()

- ✅ prevent `walk {npcKey} $navPath` from initial npc overlap
  - permit blocked walk if the navPath doesn't initially jump
  - forbid blocked walk otherwise
  
- ✅ BUG see very early collisions
  - ℹ️ stale collision e.g. Player was initially stationary and in the way,
    but was moved after the NPC started walking
  - ✅ handle `started-walking`
  - ✅ handle `stopped-walking`
  - ✅ handle `changed-speed`
    - npc foo 'x => x.setSpeedFactor(0.5)'
    - ✅ seems npcs-collide too early `andros will collide with foo {seconds: -2.3052919946376775, distA: -161.3704396246374, distB: -80.6852198123187}`
      > maybe speeds wrong way around?
```sh
# REPRO
# spawn behind the player
spawn foo zhodani $( click 1 )
# navigate in front of player
nav --tryOpen foo $( click 1 ) | walk foo
# walk player forward asap
```

- ℹ️ nav node id approach
- ✅ faster nav node lookup
  - ✅ `gm.navZone.gridToNodeIds`
  - ✅ hook up to floorGraph.findPath
- ✅ global nav path provides nav node ids
  - maybe per seg i.e. take account of string-pulling
- ❌ decor colliders inferred from nav node ids
- ✅ decor colliders inferred from global decor-grid
  - ✅ store/remove decor in global grid
  - ✅ decode line-seg into "linear" number of grid squares
- ✅ broad phase colliders replaces "cached room approach"

- ✅ door/symbol groups needn't be read-only
  > might break "slow down near door" but that's ok

- ✅ can show/hide decor colliders via `npc config showColliders`
- ✅ avoid `cssName` dup in service/const vs world/const

- ✅ BUG both `click 1`s resolved at once
```sh
spawn foo zhodani $( click 1 )
spawn bar solomani $( click 1 )
# issue:
nav --tryOpen foo $( click 1 ) |
  walk foo & nav --tryOpen bar $( click 1 ) | walk bar

```

- ✅ clean/redo Decor
  - ✅ remove groupCache i.e. use `byRoom[gmId][roomId].groups` instead
  - ❌ remove handleDevToolEdit
  - ✅ clean handleDevToolEdit
    - ✅ remove handleDevToolEdit DecorPath support
      - ℹ️ breaks navpath meaning
    - ✅ support decor point/circle/rect
    - ✅ support group via handle
  - ✅ decor must reside inside a room e.g. doorSensors
    - throw error if not
    - only log error in decor.updateLocalDecor
    - ❌ DecorPath is exception
  - ℹ️ byRoom persists i.e. acts like cache
  - ✅ visible decor determined by `fov.gmRoomIds`
  - ✅ `decor` contains all decor and persists
  - ✅ removeDecor assumes same room
  - ✅ reorg `byRoom[gmId][roomId]` so doorSensors easily accessible?
    - cleaner approach to groups in general?
    - ℹ️ DecorPath does not reside in any room, and cannot be in a group
    - ℹ️ confusing to use names and groupKeys in lookup
  
  - ✅ redo Decor again:
    > `byRoom[gmId][roomId]` has { symbol, door, decor, colliders } where symbol/door are read-only groups
    
  - ❌ redo collisions
    - ✅ remove rbush stuff
    - ℹ️ https://www.gamedev.net/tutorials/_/technical/game-programming/spatial-hashing-r2697/
    - ℹ️ https://zufallsgenerator.github.io/assets/code/2014-01-26/spatialhash/spatialhash.js
    - ✅ create `SpatialHash`
    - 🚧 don't bother with SpatialHash (at least for now)
      - ✅ cleanup roomWalkBounds approach
      - start-inside can be inferred by tracking which ones we're inside
      - also if you spawn inside/outside, enter/exit should be triggered
    - per-seg decor collisions check all colliders or spacial hash
    - ❌ remove decor.byNpcWalk
    - ℹ️ no need to fire decor `exit` on exit-room
  
- ✅ navpath issue: multiple occurrences cached in different rooms
  > it should not be cached per room

- ❌ when provide navMetas with length, insert ones for `head-to-door` and `head-from-door`
  - ℹ️ implementing this was too ugly

- towards head-towards-door and head-away-from-door events
  - ✅ use-handle-events listens for enter-room and infers next door via wayMetas
  - ✅ decor.byGmRoom -> decor.byRoom: `(Set<string>)[][]`
  - ✅ decor roomGroup includes a circle per door
  - ✅ dup decor-collide
  - ℹ️ maybe just improve rect tests so check few colliders
  - ✅ store roomWalkBounds
  - ✅ cache decor close to npc, while walking in room
  - ✅ `byRoom[gmId][roomId]` was being deleted... need better approach
    > `npc events | filter 'x => x.key === "way-point" && x.meta.key === "decor-collide"'`
    > `npc events | filter 'x => x.key === "way-point" && x.meta.key === "decor-collide"' | map 'x => x.meta.type'`
  - ✅ seems decor.meta.roomId of doorSensors is null
  - ✅ saw a seg exit but not enter, repro:
    ```sh
    spawn andros '{ x:-423.49,y:1001.69 }'
    npc events | filter 'x => x.key === "way-point" && x.meta.key === "decor-collide"' | map 'x => x.meta.type'
    ```

- ✅ turning off light should remove light through window
  - ℹ️ don't support light thru two windows in a row (and probably other cases)
- ✅ tidy lights i.e. doors/windows treated symmetrically
  - ℹ️ saw issue with window adjacent to door (unfrosted window in bridge 301)

- ❌ navPaths have extra vertex for "approaching door"
- ✅ collate use-handle-events player-related stuff
- ✅ `pre-near-door` -> `at-door`
- ✅ `pre-npcs-collide` -> `npcs-collide`

- ✅ anim.wayMetas are shifted onto anim.prevWayMetas
  > ℹ️ provides history during walk
- ❌ room local decor includes a circle per door
- ❌ door decor circles only collision tested when approach door

- ✅ CssPanZoom track initial jump is too jerky
  - ✅ initially pan to matching distance along path
  - ✅ cleanup approach

- ✅ fix nav on path.length === 1
  - ✅ seen spawn not working, maybe related to nav from to current position

- ✅ BUG resizing terminal to very small breaks display of pending input
  - attempt to `clearInput` then `setInput` adds lines, why?
- ✅ BUG very large historical input `echo {1..1000}` doesn't get cleared properly
  - ℹ️ seems real terminals don't clear input from previous page,
    e.g. `echo {1..5000} | pbcopy`

- ✅ builtin `choice` supports multiple lines
  - ℹ️ will permit cleaner line breaks
  - normalize `\n`, `\n\r` and split
  - links per line

- ✅ BUG npc vs npc collision issue
  - ℹ️ seems to be independent of speedFactor change
  - ℹ️ easy repro via speedFactor 2 and run into walking npc from behind

- ✅ support `npc.anim.speedFactor`
  - ✅ can change mid-walk
  - ✅ npc-npc collisions work at different speeds
  - ✅ npc-npc collisions work if change speed mid-walk
    - ℹ️ cannot assume uniform speed when predicting collide time (wayTimeout)
  - ✅ adjust tracking
  - ✅ npc-door collisions works when change speed mid-walk
    - account for playbackRate change?
  - ✅ clean up:
    - ❌ replace `anim.updatedPlaybackRate` with `effect.getTiming().playbackRate`.
      > remains undefined after using `anim.translate.updatePlaybackRate(...)`
    - ✅ replace `anim.initSpeedFactor` with `anim.initAnimScaleFactor`

- ✅ sliceNavPath(navPath, startId, endId)
  - ℹ️ e.g.
    - path into players room but make npc stop before room
    - path from players room but make npc start outside room
    - align npcs along disjoint parts of a path
    - npcs walk at same pace but from different points, as if following
  - creates fresh navPath, although share e.g. fullPath `Vect`s

- `navPath | walk andros`
  - ✅ on player warp then FOV updates
  - ✅ tracking is slow when npc warps

- ✅ support alias `npc get foo` -> `npc foo`

- ✅ BUG local decor should appear on open room
- ❌ BUG? when async generator returns value it is not picked up?
  > Given `async function *generator() { yield "foo"; yield "bar"; return "baz"; }`
  > return value is not picked up in `for await (const value of generator()) `


- ❌ Start section `Fabricating a behaviour`
  - ℹ️ `nav foo --tryOpen $( click 1 ) | walk foo`
  - ✅ `choice` supports read from non tty
  - ✅ example of process continued by invoking shell variable
  - ❌ example of later pipe child talking to earlier pipe child
    - can create Subject at /home/mySubject
    - earlier process converts to async iterable: `api.observableToAsyncIterable`
    - later process sends message to continue
  - ✅ implement `WhileClause` with enforced 1 second iteration length
  - ✅ get rooms nearby npc
    - gmGraph.findRoomContaining
      ```sh
      world "x => x.gmGraph.findRoomContaining($( click 1 ))"
      ```
    - roomGraph provides nearby rooms
      ```sh
      gm 0 'x => x.roomGraph'
      gm 0 'x => x.roomGraph.getAdjRoomIds(9)'
      gm 0 'x => x.roomGraph.getReachableUpto(9, (_ , depth) => depth > 4)' | \
        map 'x => x.flatMap(y => y.roomId >= 0 ? y.roomId : [])'
      ``` 
    - given nearby rooms, find decor
      ```sh
      gm 0 'x => x.roomDecor[9].filter(x => x.meta.go)'
      ```
  - ✅ support `npc get andros [selector]`
  - ✅ cache instantiated local decor
  - ❌ `npcs.getNearbyInfo(gmId, roomId, depth)`
    - ✅ should use decor.cacheRoomGroup per room
    - ❌ decor.summariseDecor(...items) 👈 maybe just output stringified decor?
    - ❌ given npc, construct choice text for nearby rooms (+ adj geomorph)
  - ❌ lazily compute getNearbyInfo
  - ❌ first | nav {npcKey} --tryOpen | walk {npcKey}
    - `first` invokes choice and also listens to `npc events`

- ✅ BUG with two terminals on same page sessionKey gets confused
  - seems `node.meta.sessionKey` is being overwritten!
  - doesn't require other terminal to run `choice`
  - happens when we initiate another terminal while first terminal awaits link click

- ✅ do-all-the-things video
  - `ffmpeg -i 'Screen Recording 2023-06-08 at 12.53.10.mov' -filter_complex "[0:v] fps=20" -b:v 0 -crf 25 output.mp4`
- ✅ Finish section `Worlds, Players and Terminals` 

- ✅ represent labels via label={label}
- ✅ `nav --tryOpen` tries to open doors on the way
  ```sh
  spawn foo zhodani $( click 1 )
  nav --tryOpen foo $( click 1 ) | walk foo
  ```

- ✅ BUG saw global navpath compute incorrect direct local path in intermediate geomorph 102
  - repro `nav andros '{"x":-889.69,"y":1315.86'}`
  - ℹ️ geomorph 102 has two disjoint navmeshes, and our (src, dst) reside in each partition
  - ✅ remove degenerate small navmesh from 101, 102
  - ✅ precompute navGroupId for each door/window
  - ✅ change definition of gm-graph so multiple geomorph nodes when multiple navmeshes
    - remove assumption that nodesArray[gmId] is unique gm node

- ✅ Split initial carousel i.e. 1 image, then 2 images
- ✅ start geomorph 103
  - ℹ️ media/symbols-png-staging/README.md
  - ✅ hull symbol (ensuring no transforms on groups!)
  - ✅ add cargo symbol
  - ✅ add initial layout geomorph-layouts
  - ✅ `yarn render-layout 103`
  - ✅ `yarn bake-lighting 103` (currently no lighting)
  - ✅ extend geomorph-layouts using GeomorphEdit to preview
    - ℹ️ beware GeomorpEdit can break if you put a symbol over a door

- ✅ BUG fix room label link 
- ✅ BUG cannot reset Tabs before ever enabled
- ✅ BUG
  - `choice [{1..10}]'()'`
  - `choice '[foo](bar) [baz](qux) [root](toot)'`

- ✅ remove remaining large doors
- ✅ Improve look of hull doors
- ✅ Put hull doors back to original dimension
- ❌ Draw hull doors wider in render-geomorph

- ✅ Avoid navigating into closed hull doors
  - ℹ️ possible now we have parallel hull doors
  - 🤔 review global nav strategy
  - ✅ can run astar on gmGraph
  - ✅ extract gm edges from result

- ✅ Avoid navigating into closed (non-hull) doors
  - ℹ️ we don't want to weight them infinitely
  - ✅ closed doors have large nav weights

- ❌ Try fix hull door nav issue by halving their size
  - possible issue with two doors being too close to each other
- ❌ Try smooth hull door navpaths using:
  - ℹ️ hard-coded extent 22 = 12 (wall outset) + 8 (hull door width) + 2 (hull outset)
  - ✅ For each (room, connected door) precompute { nearSeg, leftSeg, rightSeg }
    > (left refers to door.seg[0]; leftSeg, rightSeg go _into_ other room)
  - ✅ fix dup exit-room event
  - ❌ getGlobalNavPath post-process
  - ℹ️ post-process was doable but really ugly
- ✅ Split hull doors with space between (so nav doesn't break)

- ✅ CssPanZoom should not initially panzoom when disabled
- ✅ Doors: simplify to a single div which always fades

- ✅ create a new CodeSandbox
  - ✅ update src/components i.e. Terminal etc.
  - ✅ update src/sh i.e. shell
  - ✅ update src/geom
  - ✅ update public/{geomorphs,icons,npc}
  - ✅ update src/service
  - ✅ update src/world
  - ✅ update src/geomorph
  - ✅ update src/hooks
  - ✅ update src/graph
  - ✅ update src/panzoom
  - ✅ update src/pathfinding

- ❌ auto invert comments
- ✅ one line preamble: session {sessionKey} running /home/PROFILE
- ✅ `choice` pause/resumes like *sleep

- ✅ cleanup `choice`
- ✅ `choice` supports many initial args up to first number (if any)
  - ℹ️ for brace-expansion currently do this `choice "$( echo '['{1..50}']()' )"`
- ✅ npc.config.logTags
- ✅ cleanup CssPanZoom

- ✅ replace tty touch ui "force lowercase" with "disable textarea"
- ✅ move `api.npcs.session.tty` to `session.ttyLink`
  - ℹ️ instead of send msg `on-tty-link` we'll yield a value in accordance with link
- ✅ implement builtin `choice {textWithMarkdownLinks} [ms] [default]`
  - ℹ️ detect if link was from specific text (possibly on earlier line)
  - `choice "$( echo '['{1..50..2}']()' )"` links fail on 2nd line
  - ✅ `[foo]()` has value `"foo"`
  - `[foo](-)` has value `undefined`
- ✅ support multiline links in xterm-link-provider i.e. linkStartIndex
  - 🤔 hack: assume links with same label have same value

- ✅ can toggle room lights (js api)
- ✅ light rects have srcRoomId
- ✅ can toggle room lights (cli)
- ✅ `click 1` should block `click`
- ✅ door toggle driven by `doLoop`
  - ℹ️ currently 'pointerup' listener fires regardless of `click 1`
- ✅ npc can open door
  - ✅ js api
  - ✅ cli `npc do foo $( click 1 ) [0|1]`
- ✅ rename zhodani-a -> zhodani etc.

- ✅ BUG click-drag pan `pointerup` should have distance

- ✅ playerKey cleanup
  - ✅ npcs.event: npc-internal for cancel/pause/resume
  - ✅ track `tap`s event and cancel/pauses/resumes panZoom
  - ℹ️ on `npc set-player foo` we change FOV
    - ✅ move FOV change inside npcs.setPlayerKey
  - ℹ️ on respawn player we change FOV
  - ℹ️ on player waypoint we change FOV via handlePlayerWayEvent

- ✅ BUG `Enter` in terminal is maximising Tabs
- ✅ BUG viewPoly

- ✅ display none World subcomponents when FOV empty
  - ✅ CSS matching :not(.show-gm-{n}) .gm-{n} { display: none; }
  - ✅ Decor have className gm-{n}
  - ✅ FOV mutates CSS classes on World root el
  - ✅ can override and show everything `npc config hideGms`

- ✅ can change default world zoom/center in Tabs def
- ✅ can directly provide world layout to Tabs
- ✅ remove Portals
- ✅ TabMeta { type: 'component', class: 'World', class, filepath }
  - ✅ class in {`world`, `geomorph-edit`, ... }
  - ✅ class determines component (clean lookup.tsx)
  - ✅ TabMeta prop "props" has type corresponding to component
- ✅ HMR on change world layout

- ✅ CssPanZoom translate should preserve original position under cursor/finger

- ✅ fix SSR without Carousel height equals mobileHeight?
- ✅ simplify map pngs i.e. no navmesh

- ✅ cleanup pending todos in gmail pre new CodeSandbox
  - ✅ on spawn onto mesh, should face relative direction src --> dst
  - ✅ off-mesh decor to on-mesh decor should turn initially
    - ✅ on-mesh decor orientation issue
  - ✅ support decor groups
  - ✅ tidy local decor into decor groups
    - ℹ️ `decor.decor` should still include all decor (e.g. group items)
    - ✅ on remove decor group, remove its items
    - ✅ on remove decor group item, remove from `items` array too
  - ✅ memoize decor including groups

- ✅ BUG open door should not trigger off-mesh do
- ✅ BUG look while fading in from off-mesh breaks
  - doMeta is not nulled
- ✅ medical pods have tags `do lie obscured`

- ✅ cleanup and understand spawn vs do
  - ℹ️ we delegate to `do` inside raw-loader `spawn`
  - ✅ we should fade-in
  - ✅ cleaner npc.doMeta assignment
  - ✅ on cancel spawn ensure stays faded
  - ✅ prevent spawn on top of other npc
    - maybe distinct height issue?
  - ✅ spawn between do points should support changing npcClassKey
  - ✅ spawn should not have restricted distance
  - ✅ permit re-spawn on top of same npc at do point

- ✅ `lie` frame should have head at center
- ✅ support tags foo=bar with value JSON.parse(bar) with string fallback
  - ✅ symbols have meta
  - ✅ symbols use meta instead of tags
  - ✅ migrate:
    - ✅ orient-45 to orient=45
    - ✅ distance-100 to distance=100
    - ✅ hull-n to hullDir=n
  - ✅ bunk-beds have extra `lie` with opacity=0.25
    - ✅ fade spawn supports `meta.obscured`
    - ✅ npcs with different meta.height can spawn close
    - ❌ do point should be more visible
    - ✅ cover all instances of bunk beds


- ✅ nice images involving multiple npcs for carousel
  - ✅ implement `npcs.config.debugPlayer` (vs `npcs.config.debug`)
  - ✅ cleaner implementation of `npcs.config.debugPlayer`
  - ✅ first image
  - ✅ add more images

- ✅ `click 1`s cleanup wasn't running:
  ```sh
  nav baz $( click 1 ) | walk baz
  walk: run: Error: npc "baz" does not exist
  ```

- ✅ use map geomorph png with doors and labels
  - create {gmKey}.map.png in render-layout
- ✅ replace labels from geomorph map png with special canvas
- ✅ map/labels pauses/resumes
- ❌ DebugWorld supports local labels

- ✅ symbols have `do` points with `orient-{deg}` tags
  - ✅ up to offices
  - ✅ offices
  - ✅ the rest
- ✅ view urinals as toilets i.e. always sit
  - standing at urinal does not look good now npcs are smaller
  - also, we'd need to remove feet e.g. new anim `stand-no-feet`

- ✅ mask legs when `sit` using "surfaces" (polygons from symbols)
  - ✅ gm.roomSurfaceIds[roomId] points into gm.groups.obstacles
  - ✅ clip-path  `<NPC>` root i.e. sit bounds sans surface polys
  - ✅ fix metas too close to surface
  - ✅ cleanup code
- ✅ go back to writing
- ✅ carousel on first page
  - `ffmpeg -i test.mov -filter_complex "[0:v] fps=1" -b:v 0 -crf 30 output.mp4`

- ✅ 102 navmesh issue
  - due to `lounge--017--2x4`
  - fixed in svg symbol: prevent obstacle polys from intersecting
- ✅ change nav outsets: wallOutset=12, obstacleOutset=8
- ✅ change npc radius to 12

- ✅ `spawn` at do point triggers action

- ℹ️ looks better without map visible!
- ✅ initially map is visible (so not black before session connects)
- ✅ can toggle map
  ```sh
  npc map show
  npc map hide
  npc map # returns boolean | null
  ```
- ✅ map hidden by profile
- ✅ click head shows map then fades
- ❌ unlit symbol pngs?

- ✅ drop shadow e.g. around bed
  > https://stackoverflow.com/a/71205007/2917822
- ✅ lighter: dark overlay could be less dark?
- ✅ warn when two lights intersect (GeomorphEdit)
- ✅ prevent warns when nav degenerate (as in GeomorphEdit)
  - gm 301:  29 `gm.navZone.groups` and 29 doors...

- ✅ support `light floor` i.e. constant lit circle
  - ✅ add some test floor lights
  - ✅ restrict floor lights to their parent room
  - ✅ render floor lights in unlit/lit png
- ✅ floorLights -> floorHighlights
- ✅ non-iris doors -> double doors (including hull doors)

- ✅ fix/redo extant lights e.g. replacing some with floorHighlights
- ✅ warn when two lights rects intersect

- ✅ refine drop-shadow of chairs near tables
- ✅ fix top of head in `lie`

- ✅ avoid flicker on stop walk by fixing `getWalkCycleDuration`
- ✅ prefetch icons in `<head>`
- ✅ can change character class on respawn

- ✅ migrate npcs to Spriter
  - ✅ share repo folder "media" with windows
  - ✅ can change sprite assets
  - ✅ can output spritesheet
  - ✅ can output spritesheets
    - ✅ need Spriter pro
  - ℹ️ walk starts from idle via manual config
  - ✅ can hide hat: opacity 0 then Ctrl+D
  - ✅ create single-frame lie animation
  - ✅ create single-frame sit animation
  - ✅ prefer frame aabb to be const over all animations
    - ℹ️ source rectangle: set to animation preset
  - ❌ enforce "look towards right"
    - ctrl-click root bones and adjust {x,y,angle}
    - change each keyframe, issue if root hip bone in keyframe has angle
    - try add true root bone (x,y,angle 0)
      - issues with hierarchy editor (can prev/next keyframe though)
      - made mistake whilst translating bones for each keyframe (laborious)
  - ℹ️ continue from `top_down_man_base.edit.2.scml`
  - ✅ script npcs-meta-new.js
  - ✅ generate spritesheets for ✅ idle ✅ lie ✅ sit ✅ walk
    - use symmetric `set to animation preset` source rect and check inferred
      > e.g. idle -830,-480 -> +829,+479
    - `yarn minify-pngs static/assets/npc/man-base-variant webp`

  - ✅ script `process-sheets` media/NPC/{foo}/* -> static/assets/npc/{foo}/*
    - ℹ️ frames needn't be square so may have to change output image dimensions
    - ✅ fix look by ensuring look-right
    - ✅ fix walk start-from-idle
    - ✅ constructs webp too
  - ✅ get walk/sit/lie/idle working
    - ✅ idle -> idle-breathe
    - ✅ idle 1 frame of idle-breathe
    - ✅ more frames for idle animation if ~4000ms long...
    - ❌ need background-position offset for walk so starts from idle
      - we use `yarn process-sheets` to ensure facing right
    - ✅ unify animation names
  - ✅ BUG with anim.sprites.commitStyles() for `idle-breathe`
    - saw `background-position: -2145px 50%`

  - ✅ tidy up after Spriter Pro migration
    - ✅ remove old code
    - ✅ rename new code e.g. `yarn npcs-meta`
    - ✅ darker via `filter` + drop-shadow()
    - ✅ feet less visible in `idle`
    - ✅ create/render another character class
      - ℹ️ partial examples already exist in `top_down_man_base.edit.2.scml`
    - ✅ rename npc classes
      - man-base-variant -> vilani-a
      - man-first-variant -> zhodani-a
      ```sh
      function renameMediaPngs() {
         [[ $( x=$(pwd); echo ${x: -16} ) != the-last-redoubt ]] && {
          echo "this function must be run from repo root"
          return 1
         }
        prevName="$1"
        nextName="$2"
        cd "media/NPC/class/$prevName" &&
          for file in $( find . | grep -E "${prevName}.+\.png$" ); do
            mv $file "${nextName}${file:((${#prevName} + 2))}"
          done
      }
      renameMediaPngs man-base-variant vilani-a
      renameMediaPngs man-first-variant zhodani-a
      ```
    - ✅ change vilani-a style
      - ℹ️ assets can have different sizes,
        which must be fixed for animations to work
        > e.g. `hi_vis_above_orange` vs `black_tshirt_top`
      - ℹ️ an extract original asset from `top_down_humans_svg.svg`
    - ✅ spawn can specify class e.g.
      ```sh
      expr '{ npcKey: "bar", npcClassKey: "zhodani-a", point: '$( click 1 )' }' | spawn
      spawn foo zhodani-a $( click 1 )
      ```
    - ✅ zhodani-a has blue shirt
    - ✅ try to get batch export working
      - 👉 should probably untick unused
      - ℹ️ can force all horizontal via vert frames == 1
      - ℹ️ media png names will be `spriter_man_01_base_{animName}`
        - entity name `man_01_base`
        - chose prefix `spriter`
      - ✅ process-sheets needs to read different files
    - ✅ regenerate all: walk bounds were slightly too small
    - ✅ add npc class solomani-a
      - has hair

- ✅ Start presentation redo
- ✅ On hold Tab reset we reset Tabs layout
- ❌ lie: trace `r_s_r_m_njoy_lie.png` (1 frame animation)
  - ✅ try put shadow behind
  - ❌ really slow... maybe blender
- ✅ try parallels + spriter + top down assets
  - ✅ install parallels + windows 11
  - ✅ install Spriter https://brashmonkey.com/ and get it working
  - ✅ https://gamedeveloperstudio.itch.io/top-down-men-game-asset-character-pack
  - load assets into Spriter
    - ✅ top_down_man_base.scml

- ✅ wayMeta: redo npc vs door collisions
  - ℹ️ pre-exit-room used when leave room (hull door or not)
  - ℹ️ pre-near-door used when walk ends near a door
  - ✅ remove `pre-exit-room`
  - ❌ trigger `pre-exit-room` based on decor rect collision
    - actually we only support "point vs angled rect" and prefer not to extend
  - ✅ improve `pre-exit-room` length i.e. only when npc close

- ✅ `npc do` examples and errors
  - ✅ example `expr '{ npcKey: "foo", point:'$( click 1 )'}' | npc do`
  - ✅ can `npc {cmd} '{ suppressThrow: true }'`
  - ✅ error if not a do point
  - ✅ error if too far
  - ✅ exit code should be `1` not `130`?
  - ✅ example `npc do '{ npcKey: "foo", point:'$( click 1 )'}'` 

- ✅ geomorph PNGs have darker ground, white PNG symbols

- ✅ review npc vs npc collisions
  - ❌ more permissive when other static off-mesh
  - ❌ seen missed collisions?
  - ℹ️ clarity: makes sense + see collide-npcs.mdx

- ✅ understand and improve wayMeta triggering
  - ℹ️ wayTimeout + nextWayTimeout
  - ✅ wayTimeout wasn't being triggered after anim.translate completes
    - on anim finish, invoked startAnimation('idle') which invoked `clearWayMetas` before setTimeout could resolve
  - ✅ can use extant `stopped-walking`
  - ✅ on complete walk should see `way-point` with meta `{ key: 'vertex', final: true }`

- ✅ cannot spawn onto closed door
  - e.g. player may need to open door in order to spawn onto mesh
- ✅ restyle decor circle/rect

- ✅ clean initial `console.warn`s
  - ✅ https://www.gatsbyjs.com/docs/reference/release-notes/migrating-from-v4-to-v5/#staticquery--is-deprecated
- ✅ restyle geomorphs pngs: navmesh more visible + sharper

- ✅ handle manually paused npc on disable/enable Tabs

- ✅ if colliding and if `walk $navPath` jumps, collision cancels after/before jump
  - issue was `opts.delay ||= cancellableAnimDelayMs` introduced to smooth safari
  - Safari has jerky CssPanZoom followPath (Firefox mobile too)

- ✅ npc json has animLookup[animKey].aabb
- ❌ sit should have larger staticBounds
  > computed animLookup aabb needs scale/rotate,
  > might be better to test bounds-circle
- ✅ cannot spawn within bounds radius of npc

- ✅ svg decor have meta
- ❌ gm.decor.meta.roomIds
- ✅ restrict decor to a single room
  - gets too complex otherwise
  - can use multiple for e.g. "nearby door"
- ✅ instantiated decor organised by decor.byGmRoomId
- ✅ decor circle collisions
  - ✅ triggered by npc walk (without optimize)
  - ✅ restrict npc circle to center
  - ✅ local navPath provides roomIds aligned to fullPath
  - ✅ global navPath provides gmRoomIds aligned to fullPath
  - ✅ decor organised by gmRoomId
  - ✅ restrict collisions by gmRoomId
    - store globalNavPath.gmRoomIds in npc.anim.aux
    - using navPath.gmRoomIds and api.decor.byGmRoomId
  - ✅ shallow api.decor.byGmRoomKey
  - ✅ decor circle/rect collision induces wayMeta/event
- ✅ decor ~~rect~~ poly collisions
  - ℹ️ restrict npc to center
  - ✅ simplified approach (test all segs)
- ✅ `spawned-npc` references newly colliding decor

- ✅ BUG: chrome: cursor over decor _circle_ or _rect_
  - `npc decor '{ key: "foo", type: "circle", center: {"x":207.83,"y":384.43}, radius: 30 }'`
  - `npc decor '{ key: "bar", type: "rect", "x":207.83,"y":384.43,"width":100,"height":50 }'`
  - ℹ️ works in firefox
  - ❌ try nested div
  - ❌ try width=height=scale instead of `... scale(x)`
  - ✅ use left, top, width, height
- ✅ can represent decor circle/rect in svg symbols
  - ✅ points identified via tag decor
  - ✅ gm.point.decor retains origPoly (to infer rect/circle)
  - ✅ rects identified via tags decor, rect
  - ✅ circles identified via tags decor, circle
  - ✅ gm.point.decor -> gm.decor?
  - ✅ retype gm.point.decor as `DecorDef`s

- ✅ can click `label` points and walk to them
  - fixed via new tag `go` (ui points can be `do` or `go`)
- ✅ `[room bedroom]` link not working
  - no repro?

- ✅ use webp for lit/unlit geomorphs
- ✅ 301 shouldn't have guns
- ✅ 303 fov should cover windows

- ✅ "do points" have icons
  - ✅ consider locker icons `Ship's Locker/Iconographic`
  - ✅ stand icon
  - ✅ sit icon
  - ✅ lie icon
  - ✅ show icons
  - ✅ improve icons
  - icons get bigger when player idle/sit/stand/lie nearby
  - improve lie icon
- ✅ npc do: from off-mesh only when close enough
- ✅ npc do: to off-mesh only when close enough
- ✅ cannot spawn into different room
- ✅ data-tags -> data-meta
- ✅ remove unnecessary `ui do` stand points
- ✅ NPCS defaultNpcInteractRadius -> npc.getInteractRadius
- ✅ eliminate NPCS getPointTags

- ✅ run `render-pngs` against staterooms
  - ✅ improved manifest
  - ✅ README instructions for files

- ✅ should see more visible doors through hull door
- ✅ try eliminate `view reverse`
  - ✅ gm 101: eliminated via parallel-connectors
  - ✅ gm 302: eliminated via new wall/door
  - ❌ office 89: exactly one `view reverse` for curved window
- ✅ alternate method for eliminating "small black triangular view-intersection polys" 

- ✅ move `<Decor>` to top level

- ✅ profile has `doLoop andros &`
- ✅ fix orient again
  - needed `animation.playState === 'finished' && animation.cancel();`
- ✅ reset opacity to 1 on cancel anim.opacity

- ✅ can prevent turning whilst standing e.g. because no space
- ✅ directly fade to off-mesh point if already close
- ✅ convert site-wide icons to png/webp 24px

- ✅ dynamic lighting
  - ✅ consider removing unseen door canvas
  - ✅ avoid partially dark walls
  - ✅ try including doors in geomorph 301 png
    - ✅ show all doors in curr/adj room
    - ❌ show all doors in related room
      > instead show all doors in curr/adj + 1-step relDoorId
      > which only changes when curr room changes
    - ✅ fix half-closed-door-issue
    - ✅ hull doors should be cut out of adjacent geomorphs
      > otherwise they cover up the hull doors
  - ✅ try drawRect "unlit rects including door"
    - ✅ bake-lighting shades `rgba(0, 0, 0, 0.5)` so unlit rects will need thi
    - ✅ bake-lighting does renderLayout with doors open before shade/lights
    - ✅ move canvas into Geomorphs
    - ✅ test draw a rect from underlying geomorph and darken it
    - ✅ start reviewing light strategy
  - ✅ rename tag `light` -> `view`
  - ✅ rename tag `light-source` -> `light`
  - ✅ cleanup GeomorphEdit
  - ✅ GeomorphEdit shows `view` positions
    > too many?
  - ✅ GeomorphEdit can show fov polys
  - ✅  GeomorphEdit shows `light` positions
  - ✅ lightSrc has roomId
  - ✅ GeomorphEdit can show light polys
  - ✅ refactor GeomorphEdit state
  - ✅ GeomorphEdit restricts light by distance
    - ✅ review bake-lighting
    - ✅ support tags `light distance-180`
  - ✅ precompute light door rects
    - ✅ part of geomorph.json
    - ✅ support multiple subsequent doorways
    - ✅ initial drawRects
    - ✅ init drawRects: fix transformed
      - forgot that rects shouldn't show in light's originating room
      - still need to fix overlapping rects in e.g. geomorph 101 
    - ✅ init drawRects: await fov images ready
    - ✅ drawRects on door open/close
    - ✅ should not be dark under doors
      - ✅ exclude doors in unlit geomorph
    - ✅ realised we needed doors for fov
      - ✅ tried thin lines in {geomorph}.json
      - ✅ try x2 res
        > but no need: issue was non-integral drawImage of doorRect
      - ✅ but other bug: still light in doorway,
        and cannot drawImage without drawing thin line...
      - ✅ NEW APPROACH
        - ✅ geomorph.png has thin doors
        - ✅ create *.unlit.doorways.png
        - ✅ test 301: thin doors + drawImage from unlit.doorways
        - ✅ diag doorways by requiring adjacent light source?
        - ✅ cleanup e.g. webp, optimize
      - ❌ FOV should use canvas instead of img
      - ✅ diag doors ok if light src adjacent?
      - ✅ other bug: drawRects not going far enough
    - ✅ avoid overlapping light rects
      - ✅ 302 ✅ 303 ✅ 101 ✅ 102
      - don't forget lights can intersect if in same room
    - ✅ support diagonal doors?
      - can avoid drawImage when other side not visible?
    - ✅ handle hull doors by not allowing light thru them
  - ✅ GeomorphEdit shows light decompositions
  - ✅ light through windows? not an issue
  - ❌ canvas-based component draws unlit geomorph with doors?

- ✅ show `idle-breathe` somehow
  - ✅ can spawn whilst walking remembering angle
  - ✅ avoid reinvoking create-npc per spawn
  - ✅ consider create-npc HMR
    - ℹ️ possible i.e. could mutate npc lookup in `<NPC>`
  - ✅ do not re-mount on spawn
  - ✅ `<World>` now awaits `<Debug>`
  - ✅ remove updateAll
  - ❌ update individual npcs directly
    - no use case as yet
  - ℹ️ open door renders all npcs because local decor changes, rendering `<NPCs>`
  - ✅ can avoid `<NPC>` render via React.memo
  - ❌ can avoid `<Decor>` render via React.memo
  - ✅ `npc events`
  - ✅ event on click ui point
  - ✅ remove decor custom onClick
  - ✅ event on add/remove decors
  - ✅ event on click TTY link
  - ✅ event npc-clicked
  - ✅ synfig specifies tag `idle` and animation-direction `alternate` for keyframe idle-breathe
  - ✅ can play npc anim
    - `npc.startAnimation('idle-breathe')`
    - `npc get andros | map 'x => x.startAnimation("idle-breathe")'`
  - ✅ idle-breathe uses animation-direction
  - ❌ idle-breathe animation more accentuated
  - ✅ on click stand point, spawn and change to idle-breathe
    > see [example](/src/projects/sh/EXAMPLES.md)
  - ✅ when off navmesh, can get back on

- ✅ start shell function `doLoop`
  - ℹ️ clarity: goto point and play animation, where goto means:
    - `walk-to`
    - `walk-near-then-fade`
    - `fade-near`
  - ✅ shell function `flatMap`
  - ✅ sit/stand/lie ui points have tag `action`
  - ✅ implement `npc do` i.e. handle { point, tags/meta }
    - ✅ getNpcGlobalNav empty if src or dst outside navmesh
    - start on navmesh
      - ✅ on navmesh + point navigable => walk
      - ✅ can `npc.transitionOpacity(0, 1000)`
      - ✅ implement pause/play/cancel
      - ✅ move opacity animation to `anim.body`
      - ✅ off navmesh + point navigable => fade near then walk
      - ✅ support ui point orientation via `orient-{deg}` modified via room transform
      - ✅ stale anim.rotate via do?
    - ✅ start off navmesh
    - ✅ do not use close nav-nodes anymore
      - ℹ️ close-nav-node can look wrong e.g. stateroom chair
      - ℹ️ we always need a nav-node to return to
      - ✅ on-mesh -> off-mesh
      - ✅ off-mesh -> on/off-mesh
    - ✅ can only leave off-mesh by clicking nearby action points
      - thus always need at least one nearby on-mesh action point
    - ✅ orient can be broken if turn whilst off-mesh
      - BUG fix i.e. `orient-{deg}` -> `deg` was broken
      - Independently, `lookLoop` won't turn towards `do` tagged point
    - ❌ can click anywhere on navmesh to return to it
    - 🤔 turns towards navNode before fade-spawn
    - ✅ handle `goLoop` walk attempted during walk in `doLoop`
      - ℹ️ cancel not invoked e.g. not seeing console.log(`cancel: cancelling ${this.def.key}`);
      - ✅ IDEA `goLoop` should always cancel before doing a walk
- ✅ sit has angle

- ✅ absorb floorGraph into GeomorphData?
  - ✅ avoid expensive floorGraph fromZone
    e.g. ensure multiple usePathfinding are not re-computing
  - ✅ use `usePathfinding` in `useGeomorphData`?
- ✅ points have lookup `meta` extending tags
  - ✅ localDecor points have `{ roomId }`
  - ✅ computeTagsMeta -> extendDecorMeta
- ✅ rename tag `action` -> `do`
- ✅ `idle-breathe` should play in stand point
  > case 'cancel' was falling through

- ✅ npc.transitionOpacity -> animateOpacity
- ✅ npc.lookAt should use anim.rotate and be async
- ✅ BUG ui/action points should be transformed with geomorph
- ✅ BUG doLoop should terminate when `npc do` does
  - if pipe-children throw we kill pipe-siblings
  - seems `doLoop` throws without non-zero exitCode
- ✅ BUG close nav point can sometimes be outside navmesh

- ✅ BUG can stop in doorway then turn back, and view does not change
  - `exit-room` followed by `enter-room` for _same room_ (✅)
  - needed extra setRoom in use-handle-events

- ✅ silent fail on geomorph json parse error e.g. via missing field
  - We now log useQuery error field

- ✅ double doors issue: light going through closed one
  - ✅ fix light overflow using tag `double`
  - ⛔️ doors slightly cut off
  - ℹ️ can also happen via related door seeing both doors

- ✅ spawn initially no doors issue?
  > needed to run updateVisibleDoors before update

- ✅ Abandon _moving seg_ vs _static seg_ collision prediction
  - ✅ Hide in debug mode
  - ✅ decor seg -> rect
  - ✅ Remove related code `predictNpcSegCollision`
  - ✅ Remove related mdx

- ✅ saw light polygon error in bridge (two lockers open) Unable to complete output ring...

- ✅ initial flicker in World due to .lit.png loaded before darkened png?

- ✅ synfig file -> `NPC.ParsedNpc`
  - will replace `render-npc` script (first-npc.json)
  - ✅ export for web lottie
    - https://synfig.readthedocs.io/en/latest/export/export_for_web_lottie.html 
    - but decided to use file directly
  - ✅ script `npc-json` gunzips file.sifz and converts xml to json 
  - ✅ provide/extract animation names and lengths
  - ✅ provide/extract aabbs (?)
    - ❌ try manually specifying rectangles (no need)
    - can specify manually
  - ✅ provide/extract contact points
    - need `Canvas > Properties > Image Area` i.e. view-box
      > original magnitude was `3.245189`
  - ✅ output npc/first-anim.json
  - ✅ `npc-json` -> `render-npc` and renders PNGs using `synfig` CLI
  - ✅ add `first-anim` to service/npc-json (incremental)
  - ✅ attach `first-anim` to World
  - ✅ remove first-npc
  - ✅ remove npc-json
    - ✅ first-anim has Meta group
    - ✅ Meta has Aabb
    - ✅ aabb should be global, not per anim
    - ✅ Meta has BoundsCircle
    - ✅ Move scale factor computation into service/npc
    - ✅ script `npc-meta` creates `npcs.json` using only `static/assets/npc/*`
      > now need to apply css`{css}`
    - ✅ replace npc-json.js with npc-meta.json
  - ✅ rename `first-anim` -> `first-human-npc`

- ✅ Mobile jerky camera
  - ℹ️ https://developer.mozilla.org/en-US/docs/Web/API/Animation/cancel#exceptions
  - ✅ compare to `DOMMatrix(getComputedStyle(el).transform)`
    - translate seems 3 dp (-256.814, -288.672)
    - scale seems 5 dp
    - ⛔️ scale slightly wrong:
      - ours `1.708540439605713`
      - dommatrix `1.71543`
    - don't understand so currently use dommatrix

  - ✅ on turn player (resolves + onpointerdown)
  - ✅ on click door
  - ✅ on zoom in to player

- ✅ bake lighting into PNGs with extension .lit.png
  - ✅ 301 ✅ 302 ✅ 303 ✅ 101 ✅ 102
  - ✅ remove .shade.png approach

- ✅ Carousel fullscreen specified height

- ✅ Alt-up/down scrolls to start/end of terminal buffer
  > Useful for video after Ctrl+L
- ✅ Support multiple toggles `npc config 'foo bar'`
- ✅ 102: fix non-hull door (black)
  - moved door to engineering 47 (removing wall from PNG)
- ✅ 102: strange lights
  - chrome clip-path issue: used `will-change: transform`
- ✅ High res video facade

- Absorb `localDecor` program into `<Decor>`
  - ✅ Move MutationObserver into Decor
  - ✅ Move `localDecor` code into Decor
  - ✅ Fix Doors update bug due to `World` changes
  - ✅ Show local decor in neighbouring rooms too?

- More local decor
  - ✅ Event 'fov-changed' {gmRoomIds,added,removed}
    - those rooms with non-empty light
  - ✅ React to event via npcs.updateLocalDecor
  - ✅ Local decor points have `data-tags`
  - ✅ DebugWorld room labels -> local Decor

- ✅ BUG `source foo bar`: positive positional `bar` not propagated
- ✅ `localDecor` runs in background automatically
- ✅ Merge master `The Last Redoubt` -> `NPC CLI`
- ✅ Support global transform of navpath
- ✅ BUG resuming session resumed paused `track`

- ✅ BUG `return` should only kill current process (not leading)
- ✅ implement shell function `empty` with exit 0 iff all args empty
- ✅ implement shell function `clone`
- ✅ BUG `lastExitCode` overwritten with `0`
  - Function exitCode was not propagated to callee
- ✅ Send email to spritesheet creator
  - https://www.fiverr.com/inbox/njoygames
  
- ✅ Follow cam should trigger on "resize" tab

- ✅ Thinner hull doors
  - ✅ gm-101 (fix precision errors by removing rotation)
  - ✅ gm-102 (removed rotation)
  - ✅ gm-{301,302,303}

- ✅ BUG: 303: small room by toilet
  - Needed manual `light` positioning

- ✅ Thinner hull doors (gm-301)
  - ℹ️ hull doors can break door-room relation + global navgraph
  - ✅ ensure navmesh has hull doors (`createLayout`)
  - ✅ fix dark rect under hull doors:
    - .geomorph-dark too big (lights too small)
    - roomsWithDoors
  - ✅ global navmesh issue `gmGraph`
    - ✅ the expected 4 global edges exist (two gm301s)
    - gmGraph.findPath was wrong: doorNote.direction `null`
  - ✅ only outset hull door along entry (else extra light on the side)
  - ✅ use `hullDoorOutset` instead of hard-coded `2`

- ✅ show doors in extended fringe (better closing anim)

- ✅ Doors auto-close after N seconds
  - ✅ handle visible doors
  - ✅ handle invisible doors (refactor sans HTMLElement)
  - ✅ handle hull doors (two doors)
  - ✅ pause when world paused
  - ✅ handle case where player manually closes door

- ✅ Fix latex rendering in `/sketches`
- ✅ tracking camera should cancel when npc walk cancels
- ✅ Simplify tty msg lookup to textual identity (sans ANSI)
  - ✅ Clickable tty msgs getting out of sync
- ✅ Alt PNG filters?
  - .geomorph `brightness(51%) sepia(0.1)`
  - .geomorph-dark `contrast(200%) invert(100%) brightness(50%)`
- ✅ BUG typing `foo '` and then pasting multiple lines duplicates `foo '`
  ```
  bar
  baz
  ```
- ✅ Do not support devtool `.door.open` toggle
- ✅ Can `npc config omnipresent`
- ✅ NPCS api has Proxy `config` 
- ✅ disabling Tabs makes World transform jump
- ✅ state.anims cancel approach broke "responsive track"
- ✅ Cannot initially edit panzoom-translate
- ✅ hookup `DebugWorld` to `npc config` via CSS variables
- ✅ Tabs: Keyboard Enter Interacts
- ✅ BUG: devtool element select/scrollIntoView can break panzoom
  - `div.panzoom-parent` `scrollTop` `scrollLeft` being changed by devtool
  - Can manually fix by setting both as 0
  - Fixed by carefully adjusting functions
- ✅ Clicking on Carousel maximises image
- Carousel
  - ✅ Can Enter/Escape to Max/Min
  - ✅ Maximised initially in sync
  - ✅ Support arrow keys
- ✅ Pipeline child dies without pipeline ending
  - e.g. `click` still running here `click | nav cartesius | walk cartesius`
  - e.g. `click | ∫`
- ✅ Start working on /intro/setup
- ✅ Home page has World + Terminal demo
- ✅ Rewrite `click` without `otag` and remove latter
- ✅ Handle lack of extant Giscus discussion
- ✅ Fix abrupt NPC turn on finish walk
- ✅ Move NPC collision code into service/npc
- ✅ Consider not using invert(1) for dark-mode
- ✅ Move assets from public/* to /static/assets/*
- ✅ Fix all scripts
- ✅ Fix 404
- ✅ Fix homepage Carousel load
- ✅ Create separate homepage after all
  - has image Carousel with nice pics
  - has changelog
- ✅ Carousel: zoomed slide should be above

- Move light shade into shade PNG + `mix-blend-mode`
  - ✅ Draw a red geom.lightPolygon
  - ✅ Draw a partially transparent one
  - ✅ Draw multiple
  - ✅ move into separate PNG that can be layered
  - ✅ verify layering works

- ✅ Carousel: show labels
- ✅ Carousel: use lazy loading
- ✅ BUG disable-tabs triggered twice initially
  - prevent intersect-disable when Tabs initially expanded
- ✅ BUG turning is broken after walking
- ✅ BUG door connector not working: gm301, opposite state-rooms (?)
- ✅ BUG gm302 top-right locker doors not working

- ✅ gm302 needs connector joining inner rooms

- ✅ Can see GitHub comments
  - https://giscus.app/

- Carousel
  - ✅ image fade in/out
  - ✅ do not mount until first visible
  - ✅ auto-show based on current scroll
    - $0.addEventListener('scroll', e => console.log(e.target.scrollLeft))
    - need clear formula "scrollLeft -> slide"

- ✅ BUG image needs fixed height for SSR

- ✅ 2-shaded lights e.g. via light "frontier"
  - represent in world coords
  - converting to local coords and cut from extant

- ✅ BUG `spawn andros $( click 1 )`
- ✅ ISSUE with double doors light shade
  - pretend other double door closed
  - light shade ignores custom light positions
  - fix missing closed doors (e.g. gm101 doorId 15)

- ✅ ImageCarousel wider

- ✅ Handle scroll restoration ourselves

- ✅ BUG commitStyles was wrong e.g. try click past closed door

- ✅ BUG switch/drag tabs hiding World whilst walking
  ```sh
  goLoop: walk: run: InvalidStateError: Failed to execute 'commitStyles' on 'Animation': Target element is not rendered.
  ```

- ✅ BUG no scrollbar in Terminal if exceed scroll area when Terminal not visible
  - e.g. switch to `World` triggers rest of script
  
- ✅ CodeSandbox
  - https://codesandbox.io/dashboard/all/The%20Last%20Redoubt?workspace=549801c1-91a6-4104-84da-16da83c0a5c8
  - ✅ with new terminal
    - https://codesandbox.io/s/tty-demo-2-3oh1x8
  - ✅ new terminal supports mobile touch helper
  - ✅ Terminal + World
    - https://codesandbox.io/s/tty-world-1-0s9wfl?file=/src/sh/raw-loader.js

- ✅ BUG process sometimes needs shallow scope for `PWD` and `OLDPWD`
  - e.g. bg processes will modify "globals" `/home/PWD`
- ✅ BUG `echo ${_/foo}` should not be surrounded by square brackets

- ✅ BUG disable and reset does not reset non-persisted layout
- ✅ Tabs need not persist layout
- ✅ Can specify tabs splitter horizontal or vertical
- ✅ BUG terminal is not persisting over pages

- Rethink Carousel
  - ✅ Redo screen grabs via mobile, but without captions
  - ✅ Carousel has `i / n` overlay on each slide
  - ✅ Carousel can have captions over each slide
    - Should support crop in Carousel so can avoid manual crop on mobile
  - ✅ Add captions in Carousel props

- Rethink video
  - ✅ Embed test YouTube playlist instead
  - ✅ Embed actual YouTube playlist instead
    - `ffmpeg -i 'intro-desktop.mov' -filter_complex "[0:v] fps=20" -b:v 0 -crf 25 intro-desktop.mov.mp4`
  - ✅ Decided against making screen grabs on mobile with captions

- ✅ Remove code lookup
- ✅ NPC can start walk with either foot
- ✅ Make first videos
  - Desktop dim (768, 672) (outset 20) (tabs height 600) (window width 864)
  - Mobile dim (560, 640) (outset 4)
  - `ffmpeg -i 'first-video-desktop.mov' -filter_complex "[0:v] fps=10" -b:v 0 -crf 25 first-video-desktop.mov.mp4`
  - Use black background via dark-mode
- ✅ Basic Carousel for two videos
- ✅ BUG World was incorrectly initiating when reset Tabs

- ✅ Start new page intro.mdx
  - it will replace objective.mdx
  - ✅ better Tabs props
  - ✅ can have multiple World tabs `${worldKey}`  
  - ✅ avoid sessionKeys like `test` -- global over site
  - ✅ disable Tabs when outside viewport for 1 second
  - ✅ use a 'code' Tab
  - ✅ Better way to generate World components
  - Make some ~~GIFs~~ MP4s initially demoing Game
  - ✅ Remove codemirror
  - ✅ Replace codemirror with `prismjs`
    > https://dev.to/fidelve/the-definitive-guide-for-using-prismjs-in-gatsby-4708
  - ✅ `npc config` sets `debug` via `home.DEBUG`
  - ✅ shell var assigns attempt to interpret js value
    - e.g. DEBUG=0 assigns `0` which is falsy
  - ❌ In DEBUG mode, animate a circle on `click`
    - Can already see mouse in video

- ✅ Fix larger builds
  - code/components in lookup should be outside bundle
- ✅ BUG world does not pause when associated terminal not visible
- ✅ BUG prev open tab did not awaken post reset
- ✅ BUG prevent fast re-reset with error:
  > Uncaught TypeError: Cannot read properties of undefined (reading 'dispose') - Avoid duplicating loaded components + cleanup

- ✅ BUG /test crashes mobile
  - ✅ fix slow SvgNavGraph via direct DOM manipulation
  - ⛔️ seems to be a mobile issue with prismjs
    > https://github.com/PrismJS/prism/issues/3339
  - ✅ highlight MDX code blocks via `prism-react-render`
  - ✅ remove `code` Tabs and babel-plugin-prismjs

- ✅ Only `terminal` and certain `component`s portalised
  - ✅ `code` not inside react-reverse-portal
  - ✅ siteStore.portal -> siteStore.component
  - ✅ `code` Tabs have entry in siteStore.component
  - ✅ can have non-portalised `component` Tabs, with entry in siteStore.component

- ✅ BUG intro-world-2 awakened by enabling other Tabs
- ✅ Migrate code lookup to @loadable.
- ✅ Migrate component lookup to @loadable.
- ✅ Debug @loadable code-splitting
  - Works well without .babelrc (see below)
  - Fixed by upgrading gatsby `yarn add gatsby`
- ✅ Issue with npm module `canvas` (not built)

- ✅ Better fix for non-maximised Terminal on Mobile
  - ✅ https://developer.chrome.com/docs/devtools/remote-debugging/
  - ✅ https://developer.android.com/studio/debug/dev-options
- Fix xterm links on mobile (Chrome Android)
- ✅ BUG non-maximised Terminal on Mobile
  - ⛔️ xterm fit addon has an issue
    - avoid tall TouchHelperUI
    - `xterm.paste('')` redraws correctly
- ✅ BUG multiple tabs: enable one seems to initially mount all
- ✅ BUG terminals not getting disabled after Tabs reset
- ✅ BUG with multiple world click handling?
  - try simplifying PROFILE
  - occurs with both`goLoop andros &`, and both `lookLoop andros &`
  - problem was name-collision in `/dev`
- ✅ Migrate projects/world
- ✅ Show in test.mdx
- ✅ Migrate to React 18

- ✅ Get profile-1-a working
  - Fix initial lit issue
  - Fix persistent PROFILE issue

- ✅ When tab initially maximised, unseen tabs should not be rendered

- If Tabs initially disabled:
  - ✅ World won't request unseen geomorphs
  - ✅ Terminal initially lacks session

- ✅ profile pastes into tty
- ✅ profile paste suppresses prompt and history
- ✅ 'await-prompt' does not block 'line' commands
- ❌ non-bg source also pastes into tty
- ✅ 'await-prompt' does not block 'resolve' commands
- ✅ avoid persisting PROFILE

- ✅ create-npc now State of `<NPC>`
  - consequently, hot-reloadable

- ✅ Fix reload Tabs error:
  - NPCs.jsx:277 Uncaught (in promise) Error: npc "andros" does not exist
  - Concerns  {npcKey: 'andros', action: 'cancel'}

- ✅ on reload Tabs ensure store.tabs.enabled `true`

- ✅ Can reset while profile running, without tty errors
  - ✅ cancel pending pastes
  - ✅ cleanup session xterm
    - ✅ cancel ongoing commands
    - ✅ unlink tty

- ✅ Disable/Enable Tabs should not make idle npc walk again

- ✅ `ready` -> `awaitWorld`
- ✅ Initial panzoom error (cancelled) should not propagate 
- ✅ Avoid full refresh on change `World`
  - ISSUE with getter inside `useStateRef` i.e. `state` was undefined
- ✅ `spawn` should not finish until npc mounted and NPCS.npc[key] exists

- ✅ `spawn foo $( click 1 )` should not trigger a walk
  - seems `goLoop` is receiving click before npc has moved, so plans a walk
  - we force click to be ignored by earlier handlers

- ✅ fix stateroom 100 (as seen in gm 303)

- ✅ stop npc from walking through doors
  ```sh
  nav foo $( click 1 ) | walk foo
  ```
- ✅ rethink light through nearby doors
- ✅ Weird animation pause on disable Tabs
- ✅ Change Tabs splitter size on mobile
  ```tsx
  (jsonModel.global = jsonModel.global || {}).splitterSize = 16;
  (jsonModel.global = jsonModel.global || {}).splitterExtra = 12;
  ```

# Video Notes

## First CLI video

- Web browser right, devtools left, mainly zoom right
- Tabs component: Left tab `World`, Right tab `Terminal`.
- `World` quick summary:
  - open door, see more, move through door, view from above
  - Starship Geomorphs by Robert Pearce 
  - zoom out to see "big world" built from Geomorphs
- Now `Terminal`, which "runs the NPCs"
- ... <!-- cli-frontpage-test-3.mov @1 min -->

## 🚧 Homepage CSS video

Camera via CSS transforms:
- `.panzoom-parent`
- Can edit transforms (translate/scale)

geomorphs
- `.panzoom-parent .geomorphs`
- position `absolute` is relative to `.flexlayout__tab`
- can remove image and undo
- can remove shade and undo
- can change filter: brightness, sepia, invert(1)

debug
- --debug-gm-outline-display `npc config gmOutlines`
- --debug-room-nav-display `npc config localNav`
- --debug-room-outline-display `npc config localOutline`
- --debug-show-ids `npc config showIds`

npcs
- `.decor-root`
  - move navpath nodes
  - witness mutation `npc decor andros-navpath | map 'x => x.path'`
  - 🚧 collective translate
- `.npc.andros` 🚧
  - manually translate
  - `<img>` included to load walk animation early
  - --npc-bounds-radius
    - not configurable via `npc config`
    - `spawn foo $( click 1 )` + use adjusted bounds
- --npc-target-look-angle
  - not configurable via `npc config`
  - `npc get andros | map Object.keys | split`
  - `npc get andros | map 'x => x.setLookRadians(0)'`

fov
- observe clip-path changing
- remove and undo
- change filter

doors
- toggle door via click
- toggle door via class `open` on `div.door`

## 🚧 Another CLI video

```sh
# view shell function names
declare -F
# view definition of `range`
declare -f range
range
# []
range 10
# [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

range 10 | split
range 10 | split | map 'x => x + 1'
range 10 | split | map 'x => x + 1' |
  run '({ api, datum }) {
    while ((datum = await api.read()) !== null) {
      yield datum
      yield* api.sleep(1)
    }
  }'
```

## Screen captures

✅ Convert a screen recording to MP4 or GIF

- ```sh
  # Convert mov to mp4
  ffmpeg -i ~/Desktop/first-attempt.mov -qscale 0 output.mp4
  # Convert mov to gif
  ffmpeg -i ~/Desktop/first-attempt.mov -qscale 0 output.gif
  ```
- file:///Users/robmyers/coding/the-last-redoubt/public/output.gif

✅ Smaller + Faster GIF

- https://www.baeldung.com/linux/convert-videos-gifs-ffmpeg#creating-a-custom-palette
- ```sh
  # 20 seconds (orig 19s), output 4.3mb
  ffmpeg -i ~/Desktop/first-attempt.mov -t 20 -filter_complex "[0:v] fps=10,scale=720:-1" output.gif
  # 1.3Mb
  ffmpeg -i ~/Desktop/first-attempt.mov -t 20 -filter_complex "[0:v] fps=10,scale=400:-1" output.gif
  # 1.1Mb
  ffmpeg -i ~/Desktop/first-attempt.mov -t 20 -filter_complex "[0:v] fps=10,scale=300:-1" output.gif
  ```
- file:///Users/robmyers/coding/the-last-redoubt/public/output.gif

- too large

- ❌ CSS GIF pause-reset/play https://css-tricks.com/pause-gif-details-summary/

✅ Try MP4 and WebM

```sh
# 210kb
ffmpeg -i ~/Desktop/first-attempt.mov -t 20 -filter_complex "[0:v] fps=10,scale=400:-1" output.mp4
# 300kb
ffmpeg -i ~/Desktop/first-attempt.mov -t 20 -filter_complex "[0:v] fps=10,scale=400:-1" output.webm
```

Useful info here too
> https://www.smashingmagazine.com/2018/11/gif-to-video/

```sh
# 250kb
ffmpeg -i ~/Desktop/first-attempt.mov -t 20 -filter_complex "[0:v] fps=10,scale=400:-1" -b:v 0 -crf 25 output.mp4
```

How to embed video?
> https://www.smashingmagazine.com/2018/11/gif-to-video/#replace-animated-gifs-with-video-in-the-browser


## Future

```js
// Find length up to startId
const [length] = fullPath.slice(1, startId + 1).reduce(([sum, prev], p) =>
  [sum + prev.distanceTo(p), p]
, [0, fullPath[0]]);
```

- Explain what is happening in NPCS trackNpc
- Generate GraphViz graphs from FloorGraph, RoomGraph and GeomorphGraph
- ✅ BUG CssPanZoom zoom out with pointer down and drag around
  - Also issues when click on `HTMLImageElement`s in devtools
- Alt approach to g302 light issue
  - add extra wall/door to "break loop"
  - support "always open doors" i.e. not even visible
- BUG can open hull door late whilst walks so npc underneath
- GeomorphEdit: windows: fix console errors 
- More efficient light shade
  - own component
  - avoid recompute when irrelevant doors opened/closed
- Tabs remember scroll (use case?)
- BUG CssPanZoom zoom via info is a bit jerky at one point
- ✅ Always show navpath (no need for DEBUG=true)
- ❌ CodeMirror highlighting for JSDoc types?
- Fix eslint warns
- Start using `_` i.e. last value shortcut
- Nav should weight closed doors
- Fix HMR of NPC (walks without going anywhere)
- Spawn should trigger a player collision test
- Avoid overwrite e.g. public/geomorph via pages/geomorph.mdx
- Saw `World` fail silently due to use-geomorph-data bug
- anchor/action link sends user back to Tabs, displaying text in session
  - perhaps text added to "queue", and opens respective `Terminal`?
- BUG firefox mobile jerky
  - problem with `track andros &`
  - perhaps a race-condition between two transforms (camera, npc)
- Terminal Context-Menu Copy/Paste missing
  - Works at xterm-helper-textarea, at top of terminal
  - Even if we got this to sync with cursor, wouldn't be enough