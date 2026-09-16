# volume-bake

Deterministic replay of accepted compact volume inputs. This is a private workspace package; it is not published.

```text
src/
  compact-inputs/  Validated field, density, material and star replay
  compiler/        Target-neutral compiler baking and component layouts
  slices/          Offline XYZ sampling and image encoding
```

Dependencies: volume-core; explicit renderer and star-asset backends supplied by the host. Consume explicit package exports rather than another package’s source paths.

Run `pnpm --filter @cssearth/volume-bake typecheck` from the repository root after installing dependencies. The lab command runner discovers tests beside package owners.

The public `package.json` export owns the `nebulaImplementation` inventory used by preparation fingerprints. Hosts resolve the package and hash its manifest plus matching implementation files under stable package-relative names; moving the package does not change its identity. Tests are excluded by the package configuration.
