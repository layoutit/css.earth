# Comet proof of concept

One PR adds three independently selectable nucleus packages to the existing generic object registry. The shared shell and camera remain the owners of interaction. Each nucleus has 1,000 prepared native PolyCSS triangles; all geometry, maps, normals and shadows are prepared before runtime.

| Object | Geometry source | What the default view represents |
| --- | --- | --- |
| [67P/Churyumov–Gerasimenko](../../src/planets/comet-67p/SOURCE.md) | ESA/RMOC MTP019, 104,192 source triangles | Rosetta nucleus geometry with a neutral gray model material. The neck and non-convex topology are retained. |
| [103P/Hartley 2](../../src/planets/comet-103p/SOURCE.md) | Farnham & Thomas (2013), EPOXI PDS model, 32,040 source triangles | The published complete model, colored by its source constraint flags. The cartographic long axis is not treated as a spin axis. |
| [9P/Tempel 1](../../src/planets/comet-9p/SOURCE.md) | Farnham & Thomas (2013), combined Deep Impact/Stardust-NExT PDS model, 32,040 source triangles | The published complete model, colored by its source constraint flags. |

For Hartley 2 and Tempel 1, gray marks stereo-controlled regions, blue marks limb-silhouette constraints, and ochre marks poorly constrained source estimates. Those estimates belong to the archived model. cssEarth adds no replacement terrain. The optional gray Shape model lens is an inspection material, not an albedo photograph.

The display does not simulate dust, a coma, jets, tails or outgassing. Neither PDS comet has an invented uniform spin. All phases are explicitly arbitrary. Solar placement uses JPL Horizons osculating elements at JD 2461286.5 (3 September 2026 TT); it is not a long-term ephemeris. Independent Horizons vector checks at that epoch agree within 1 mm. At ±30 days the largest measured conic discrepancies are 329.06 km for 67P, 390.29 km for Hartley 2, and 5,181.10 km for Tempel 1. Per-body regression guards add about 15% headroom under a separate 10,000 km nearby-placement budget. Runtime does not extrapolate the display epoch.

## Additional candidates

[CANDIDATES.md](CANDIDATES.md) records the exact Wild 2, Borrelly and Halley products inspected, their source limitations and the remaining qualification work. Wild 2's synthetic completion is excluded; its observed hemisphere remains a candidate. Borrelly requires an image-frame partial terrain presentation. Halley requires an explicitly uncertain historical model interpretation. None has a placeholder scene.

A discarded intake experiment removed all PDS faces touching a poorly constrained vertex. That broke Hartley 2's visible neck and made the display misleading. The included packages instead preserve the published scientific model and expose its uncertainty categories. This decision does not claim that the entire model was measured directly.

## Review evidence

[QUALIFICATION.md](QUALIFICATION.md) records exact checks, local browser evidence and remaining gate failures. [PERFORMANCE.md](PERFORMANCE.md) records the drag workload and measured results. [GEOMETRY.md](GEOMETRY.md) quantifies sampled source-fit and silhouette differences. Each object retains its original source labels, byte/hash pins, acquisition recipe and interpretation notes beside the package.
