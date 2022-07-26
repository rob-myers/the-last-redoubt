# TODO

## In progress

- Migrate lookup to @loadable.
- ✅ Debug @loadable code-splitting
  - Works well without .babelrc (see below)
  - Fixed by upgrading gatsby `yarn add gatsby`
- ✅ Issue with npm module `canvas` (not built)

- 🚧 Start new page intro.mdx
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
  - In DEBUG mode, animate a circle on `click`
    - attach fading, auto-removed decor
    - this will help with videos
  - Better maximised Tab centering + body lock?
  - Render something with graphviz extension
  - Some graphs between early paragraphs

- Fix larger builds
  - code/components in lookup should be outside bundle

- CodeSandbox
  - 🚧 with new terminal
  - terminal + World
- StackBlitz too

- Can see GitHub Comments on site

- Bigger white doors
- Better door collision detection
  - circle along line seg vs a door line-seg
  - perhaps quadratic in two variables?

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

- BUG CssPanZoom zoom out which pointer down and drag around
- ✅ Always show navpath (no need for DEBUG=true)
- ❌ CodeMirror highlighting for JSDoc types?
- Fix eslint warns
- Start using `_` i.e. last value shortcut
- Nav should weight closed doors
- Fix HMR of NPC (walks without going anywhere)
- Spawn should trigger a player collision test
- modularise npc JSON
- Avoid overwrite e.g. public/geomorph via pages/geomorph.mdx
- Saw `World` fail silently due to use-geomorph-data bug
- anchor/action link sends user back to Tabs, displaying text in session
  - perhaps text added to "queue", and opens respective `Terminal`?

## Done

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