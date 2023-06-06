# Starship Symbol Pipeline

Fix a particular [Starship Symbol](http://travellerrpgblog.blogspot.com/2020/08/starship-symbols-book.html) PNG we wish to use.

1. Put `foo.png` in this directory.

1. Manually remove any letters from labels e.g. use OSX Preview.
   Remove doors.
   Possibly remove part of walls if e.g. desire more symmetric symbol with multiple optional doors.

1. Run `yarn simplify-pngs media/symbols-png-staging`.

1. Copy the resulting file to `/static/assets/symbol/foo.png`.

1. Create `/static/assets/symbol/foo.svg` in Boxy SVG.

1. Use `/static/assets/symbol/foo.png` as background i.e. Image inside folder (SvgGroupElement) named "background".

1. Build the SVG e.g. obstacles, walls, singles.


# Hull Symbol Pipeline

When building a geomorph in `geomorph-layouts.js` you first need a hull symbol.

1. Pick a geomorph from `media/geomorph-core` or `media/geomorph-edge`.
   
   If it doesn't exist you can run:
   ```sh
   yarn rename-pngs geomorph 'media/Geomorphs/100x100 Core' media/geomorph-core
   yarn rename-pngs geomorph 'media/Geomorphs/100x50 Edge' media/geomorph-edge
   ```

2. Copy the PNG of the desired geomorph to e.g. `static/assets/debug/g-103--cargo-bay.png`.
   This is used by `GeomorphEdit` to provide an overlay.

3. Create a new symbol e.g. `static/assets/symbol/103--hull.svg` and import the PNG.
   Put the PNG inside group `background` and set its opacity as `0.3`.

4. Extend the symbol as intended e.g. reuse object `hull` and `singles > door hull` and `singles > parallel-connectors` from another hull symbol of similar type (core or edge).
