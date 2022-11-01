# TODO

## In progress

- Retarget:
  - `The Last Redoubt` -> `NPC CLI`
  - Web development focus
    - Edit via our Terminal
    - Edit via Chrome Devtools
  - Programming NPCs

- Clickable tty msgs getting out of sync: seek repro

- ✅ Document npc vs line-seg collision
- 🚧 Implement npc vs line seg collision predict
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

## Lighthouse Links

### @loadable working on /intro

https://googlechrome.github.io/lighthouse/treemap/?gzip=1#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