# lab

Internal React application, processing server and command orchestration. This is a private workspace package; it is not published.

```text
src/
  shell/           Application entry and retained scene host
  pages/           Workflow pages
  features/        Domain-specific controls
  state/           Workflow and persisted display state
  server/          Durable jobs, routes and workers
  adapters/        Explicit integration with the cssEarth host
  cli/             Named commands and test discovery
browser/           Application interaction checks
```

Dependencies: `@cssearth/bake/volume`, `@cssearth/bake/volume/node`, reconstruction and volume-viewer. Consume explicit package exports rather than another package’s source paths.

Run `pnpm --filter @cssearth/nebula-lab typecheck` from the repository root after installing dependencies. The lab command runner discovers tests beside package owners.

Research entrypoint: `labs/nebula/run.mts`. Ordinary application replay uses `tools/nebula/prepare.mts` separately. See [validation scope](../../docs/internal-packages.md) for routine CI and artifact-dependent checks.
