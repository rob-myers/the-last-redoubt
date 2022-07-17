# TODO

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

- 🚧 Avoid reload Tabs error during `ready` or similar
  - can reset while profile running
  - cleanup session xterm
    - cancel ongoing commands
    - unlink tty

- NPC spawn too "slow" for initial collision detect?
  - Saw walk-vs-walk collision fail
- modularise npc JSON
- `ready` -> `await-world`
- Initial panzoom error (cancelled) should not propagate 
- Avoid full refresh on toggle CssPanZoom grid

- Start new page intro.mdx
  - it will replace objective.mdx

- Avoid overwrite e.g. public/geomorph via pages/geomorph.mdx

- ✅ Weird animation pause on disable Tabs
- ✅ Change Tabs splitter size on mobile
  ```tsx
  (jsonModel.global = jsonModel.global || {}).splitterSize = 16;
  (jsonModel.global = jsonModel.global || {}).splitterExtra = 12;
  ```
  