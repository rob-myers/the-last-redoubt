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

## Gotchas

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

- DOMMatrix `{ a b c d e f }` corresponds to affine matrix:
  > $$
\begin{bmatrix}
a & c & e \\
b & d & f
\end{bmatrix}
$$