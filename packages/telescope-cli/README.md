# @cssearth/telescope-cli

The `telescope` command: explore observations of a target, retrieve an exact chosen product with its qualification evidence,
and turn qualified data into outputs. Until the command's implementation moves into this package, its user guide, commands,
exit codes and output formats stay in the [telescope package README](../telescope/README.md), which the help text links to.

The command runs against a **css.earth science checkout**, which holds the telescope's implementation
(`tools/objects/telescopes/`), the source manifests and any required Python environments. It finds the checkout from
`--workspace PATH`, `CSSEARTH_WORKSPACE`, or the directory it is run in, and runs the implementation there with the same
arguments, TTY state and exit code. `telescope --version` reports this package's version; each product receipt records the
scientific software and inputs used.

Inside the repository, use `pnpm telescope --help`. To test the distributable:

```sh
pnpm build:telescope-cli
npm pack ./packages/telescope-cli
npm install -g ./cssearth-telescope-cli-0.1.0.tgz
export CSSEARTH_WORKSPACE=/path/to/css.earth
```

The telescope library the implementation builds on is [`@cssearth/telescope`](../telescope/README.md#library).
