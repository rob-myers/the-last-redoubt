# The Last Redoubt

```sh
# Local development
yarn dev

# Local build
yarn build
cd public
npx http-server
```
## Links

- [TODOs](/docs/TODO.md).
- [General dev info](/docs/DEV-INFO.md).

## Gotchas

1.  MDX Frontmatter consistency
    > Given _Foo.mdx_ with `- next: bar`, _Bar.mdx_ needs `- pre: foo`.