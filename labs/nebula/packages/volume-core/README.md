# Volume core

Private, platform-neutral contracts and numerical operations shared by the nebula research tools, deterministic baker and retained viewer.

```text
src/
  contracts/     Fields, frames, observation rasters, controls and bake-result validation
  coordinates/  Calibrated sky projection, image placement and registration
  fields/       Finite emission, sampled density, diffuse atom gridding and support windows
  materials/    Finite-component/sampled color, slab integration and registered contrast
  sampling/     Registered RGB/scalar interpolation
```

Use the explicit `@cssearth/volume-core/<folder>/<module>` exports. The package has no filesystem, browser, renderer or research runtime dependencies. Its physical frame type reuses the canonical `@cssearth/objects` contract through a type-only dependency. Source `.ts` exports are consumed by the repository's internal toolchain; this package is not published.

Field positions and stellar contracts retain west/north/away coordinates and their declared units. Photographic material never creates emission support. Finite-component material and historical registered-ray material remain distinct operations; a projection match does not establish physical depth.

`pnpm --filter @cssearth/volume-core typecheck` checks the package with ECMAScript libraries only. During migration, existing tests and imports can use temporary lab-path re-exports; those contain no numerical implementation.

Sampled replay evaluates accepted spatial samples and finite atoms without rerunning image fitting. The sampled recipe validator accepts a source-path policy from its host; the research adapter retains its restricted model/cache paths. Cancellation uses a structural `throwIfAborted()` contract so the numerical owners require neither Node nor DOM globals.
