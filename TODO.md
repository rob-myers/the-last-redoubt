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

- Start new page intro.mdx
  - it will replace objective.mdx

- ✅ Weird animation pause on disable Tabs

- Avoid full refresh on toggle CssPanZoom grid

- Modularise access to npc json/png

- Avoid overwrite e.g. public/geomorph via pages/geomorph.mdx

- ✅ Change Tabs splitter size on mobile
  ```tsx
  (jsonModel.global = jsonModel.global || {}).splitterSize = 16;
  (jsonModel.global = jsonModel.global || {}).splitterExtra = 12;
  ```
  