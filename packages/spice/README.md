# @cssearth/spice

The repository's reader of NAIF SPICE kernels, for the preparation tools. The main entry evaluates kernel bytes and text
with no Node built-ins; kernel files on disk and the pinned mission kernel banks are behind `@cssearth/spice/node`.

```sh
pnpm build:spice
pnpm --filter @cssearth/spice typecheck
pnpm --filter @cssearth/spice test
```
