# NPC CLI

```sh
# Local development
yarn dev

# Check types
yarn types
# Lint
yarn lint

# Local build
yarn build
cd public
npx http-server
```
## Links

- [TODOs](/docs/TODO.md).
- [General dev info](/docs/DEV-INFO.md).

## Scripts

```sh
# Generate all geomorph jsons in static/assets/geomorph
yarn svg-meta --all

# ...
```

## Optional Dependencies

```sh
# Synfig CLI https://www.synfig.org/
# Used by `yarn render-npc`
brew install synfig

# Convert PNGs to WEBP
# Provides cwebp
brew install webp

# Minify PNGs (lossy)
# https://pngquant.org/
# Seems much better than optipng
brew install pngquant

# Image manipulation
# Used by ...
brew install imagemagick

# Minify PNGs, although tinypng much better
# Used by `yarn minify-pngs`
brew install optipng
```

Symbol PNGs should be unzipped in /media
- [SymbolsHighRes.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/SymbolsHighRes.zip)

Geomorph PNGs (background in hull symbols) should be unzipped in /media
- [Geomorphs.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/Geomorphs.zip)

Related resources (less/more resolution)
- [Symbols.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/Symbols.zip)
- [GeomorphsHighRes.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/GeomorphsHighRes.zip)

## Gotchas

- If we rename fields used by `npcs-meta.json` we must also run:
  ```sh
  yarn npcs-meta
  ```
  Otherwise type errors will occur because we cast the inferred JSON types as their original type (see `process-sheets`).

- Saw CSS animation of `background-position` fail for a webp file
  - possibly due to initial processing with `pngquant`
  - possibly due to asm operations (we now `-noasm`)
  - can try removing `webp` CSS class from `.npc .body`

- `yarn` fails for node-canvas on Apple M1
  ```sh
  brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman
  ```

- MDX Frontmatter consistency
  > Given _Foo.mdx_ with `- next: bar`, _Bar.mdx_ needs `- pre: foo`.

- Clearing persisted Tabs
  > Try changing its config (in MDX) and refreshing.
  > Otherwise a React hook will write it on page close.

- Changing the geomorph JSON data structure and not migrating all geomorphs can produce hard-to-debug errors.
  > Some of the `useGeomorph`s go into idle state, and don't throw an error (why?).

- Shortcuts inside `useStateRef` initializer can break HMR,
  > e.g. `anim` instead of `this.anim` inside create-npc

- Shell functions should avoid single-quotes `'` inside JavaScript function bodies.
- No single-quotes are allowed in `raw-loader.js`, even in a comment

- DOMMatrix `{ a b c d e f }` corresponds to affine matrix:
  > $$
  \begin{bmatrix}
  a & c & e \\
  b & d & f
  \end{bmatrix}
  $$

- Gatsby failure `(0 , _genMapping.maybeAddMapping) is not a function`
  - Related to postinstall scripts
  - https://stackoverflow.com/questions/72308375/im-getting-the-error-genmapping-maybeaddmapping-is-not-a-function-when-i-try
  - Solved by `rm -rf node_modules && yarn`

- Careful not to misconfigure `gatsby-plugin-gatsby-cloud`
  - Do not cache app-data.json and page-data.json for a long time!
  - We introduced cache-busting code from https://stackoverflow.com/a/58238793/2917822

- When rendering a geomorph, we must also render it with lighting:
  ```sh
  # render geomorph 101, which is actually inverted to provide darkness
  yarn render-layout 101
  # render geomorph 101 with baked-in lighting, which is actually the floor
  yarn bake-lighting 101
  ```
  Likewise if we update the light positions we should re-bake.