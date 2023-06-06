Fix a particular [Starship Symbol](http://travellerrpgblog.blogspot.com/2020/08/starship-symbols-book.html) PNG we wish to use in our video game.

1. Put `foo.png` in this directory.

1. Manually remove any letters from labels e.g. use OSX Preview.
   Remove doors.
   Possibly remove part of walls if e.g. desire more symmetric symbol with multiple optional doors.

1. Run `yarn simplify-pngs media/symbols-png-staging`.

1. Copy the resulting file to `/static/assets/symbol/foo.png`.

   > ℹ️ for full geomorph pngs, we only import it into the hull symbol e.g. `103--hull.svg`

1. Create `/static/assets/symbol/foo.svg` in Boxy SVG.

1. Use `/static/assets/symbol/foo.png` as background i.e. Image inside folder (SvgGroupElement) named "background".

1. Build the SVG e.g. obstacles, walls, singles.
