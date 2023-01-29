# TODO

## In progress

- review how `relate-connectors` extends visible rooms
  - ✅ rather explicit but probably right
  - document what is going on
  - can show lights/connectors in GeomorphEdit

- `<Doors>` are slightly offset from underlying door in PNG
- split hull doors into two
- can specify door as `split`
- should see more visible doors through hull door

- 🚧 dynamic lighting
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
  - 🚧 try drawRect "unlit rects including door"
    - ✅ bake-lighting shades `rgba(0, 0, 0, 0.5)` so unlit rects will need thi
    - ✅ bake-lighting does renderLayout with doors open before shade/lights
    - ✅ move canvas into Geomorphs
    - ✅ test draw a rect from underlying geomorph and darken it
    - 🚧 start reviewing light strategy
    - ...
  - redo lit geomorph 301 where lights only intersect in same room
  - ...

- 🚧 Synfig https://www.synfig.org/
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

- 🚧 auto-min spritesheet/geomorph/etc PNGs
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
  - geomorphs use webp with png fallback

- can specify npc filter e.g. `sepia(1)`
- ✅ strategy for prefetching spritesheets

- watch synfig files and re-render?

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

- Explain what is happening in NPCS trackNpc
- Generate GraphViz graphs from FloorGraph, RoomGraph and GeomorphGraph
- BUG CssPanZoom zoom out with pointer down and drag around
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

## Done

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
