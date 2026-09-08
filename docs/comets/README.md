# Comet proof of concept

One PR adds five independently selectable nucleus packages to the existing generic object registry. The shared shell and camera remain the owners of interaction. Halley, 67P, Hartley 2 and Tempel 1 each have 1,000 prepared native PolyCSS triangles; Wild 2 has 992. All geometry, maps, normals and shadows are prepared before runtime.

| Object | Geometry source | What the default view represents |
| --- | --- | --- |
| [1P/Halley](../../src/planets/comet-1p/SOURCE.md) | Stooke's historical Giotto/Vega radius grid, 2,701 rows | Highly uncertain historical shape with neutral material and an illustrative fixed attitude. |
| [67P/Churyumov–Gerasimenko](../../src/planets/comet-67p/SOURCE.md) | ESA/RMOC MTP019, 104,192 source triangles | Rosetta nucleus geometry with a neutral gray model material. The neck and non-convex topology are retained. |
| [103P/Hartley 2](../../src/planets/comet-103p/SOURCE.md) | Farnham & Thomas (2013), EPOXI PDS model, 32,040 source triangles | The published complete model, colored by its source constraint flags. The cartographic long axis is not treated as a spin axis. |
| [9P/Tempel 1](../../src/planets/comet-9p/SOURCE.md) | Farnham & Thomas (2013), combined Deep Impact/Stardust-NExT PDS model, 32,040 source triangles | The published complete model, colored by its source constraint flags. |
| [81P/Wild 2](../../src/planets/comet-81p/SOURCE.md) | Full PDS v2.1 plate model, 17,518 source triangles | Observed terrain with the published estimated ellipsoid and joining faces marked by grid texels. |

For Hartley 2 and Tempel 1, gray marks stereo-controlled regions, blue marks limb-silhouette constraints, and grid texels mark poorly constrained source estimates in both views. Those estimates belong to the archived model. The Shape model lens uses gray for the stronger constraints. These are inspection materials, not albedo photographs. Halley has no regional confidence flags, so it uses a visible whole-model uncertainty label.

The display does not simulate dust, a coma, jets, tails or outgassing. The PDS comet models have no invented uniform spin. All phases are explicitly arbitrary. Solar placement uses JPL Horizons osculating elements at JD 2461286.5 (3 September 2026 TT); it is not a long-term ephemeris. Independent Horizons vector checks at that epoch agree within 2 mm. At ±30 days the largest measured conic discrepancies include 329.06 km for 67P, 390.29 km for Hartley 2, 5,181.10 km for Tempel 1, and 557.99 km for Halley. Per-body regression guards add about 15% headroom under a separate 10,000 km nearby-placement budget. Runtime does not extrapolate the display epoch.

## Additional candidates

[CANDIDATES.md](CANDIDATES.md) records source limitations and dispositions. Wild 2 uses the archive's explicitly estimated completion; Halley uses the labelled historical model. Borrelly remains unresolved because its inspected source describes image-frame partial terrain, with no placeholder scene.

A discarded intake experiment removed all PDS faces touching a poorly constrained vertex. That broke Hartley 2's visible neck and made the display misleading. The included packages instead preserve the published scientific model and expose its uncertainty categories. This decision does not claim that the entire model was measured directly.

## Review evidence

[QUALIFICATION.md](QUALIFICATION.md) records exact checks, local browser evidence and remaining gate failures. [PERFORMANCE.md](PERFORMANCE.md) records the drag workload and measured results. [GEOMETRY.md](GEOMETRY.md) quantifies sampled source-fit and silhouette differences. Each object retains its original source labels, byte/hash pins, acquisition recipe and interpretation notes beside the package.

Follow-up evidence: [Halley](HALLEY.md), [Wild 2 completion](WILD2-COMPLETION.md),
[Wild 2 grid](WILD2-GRID.md), and [Hartley/Tempel grids](CONSTRAINT-GRIDS.md).
[Main integration](MAIN-INTEGRATION.md) records the combined registry checks.
Earlier evidence retains its original revision and scope.

[67P OSIRIS application lens](67P-OSIRIS-INTEGRATION.md) records the optional
photographic dataset, source qualification, lighting behavior and browser gates.
The [original trial](67P-OSIRIS-TRIAL.md) preserves its separate camera comparison.

[67P OSIRIS coverage](67P-OSIRIS-COVERAGE.md) records the four-observation mosaic,
the MiARD candidate disposition and source-selection evidence.
