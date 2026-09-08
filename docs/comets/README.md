# Comet proof of concept

One PR adds three independently selectable nucleus packages to the existing generic object registry. The shared shell and camera remain the owners of interaction. Each nucleus has 1,000 prepared native PolyCSS triangles; all geometry, maps, normals and shadows are prepared before runtime.

| Object | Geometry source | What the default view represents |
| --- | --- | --- |
| [67P/Churyumov–Gerasimenko](../../src/planets/comet-67p/SOURCE.md) | ESA/RMOC MTP019, 104,192 source triangles | Rosetta nucleus geometry with a neutral gray model material. The neck and non-convex topology are retained. |
| [103P/Hartley 2](../../src/planets/comet-103p/SOURCE.md) | Farnham & Thomas (2013), EPOXI PDS model, 32,040 source triangles | The published complete model, colored by its source constraint flags. The cartographic long axis is not treated as a spin axis. |
| [9P/Tempel 1](../../src/planets/comet-9p/SOURCE.md) | Farnham & Thomas (2013), combined Deep Impact/Stardust-NExT PDS model, 32,040 source triangles | The published complete model, colored by its source constraint flags. |

For Hartley 2 and Tempel 1, gray marks stereo-controlled regions, blue marks limb-silhouette constraints, and ochre marks poorly constrained source estimates. Those estimates belong to the archived model. cssEarth adds no replacement terrain. The optional gray Shape model lens is an inspection material, not an albedo photograph.

The display does not simulate dust, a coma, jets, tails or outgassing. Neither PDS comet has an invented uniform spin. All phases are explicitly arbitrary. Solar placement uses JPL Horizons osculating elements at JD 2461286.5 (4 September 2026 TT); it is not a long-term ephemeris. Independent Horizons vector checks at that epoch agree within 1 mm. At ±30 days the largest measured conic discrepancies are 329.06 km for 67P, 390.29 km for Hartley 2, and 5,181.10 km for Tempel 1. Per-body regression guards add about 15% headroom under a separate 10,000 km nearby-placement budget. Runtime does not extrapolate the display epoch.

## Additional candidates

| Candidate | Evidence reviewed | Current boundary |
| --- | --- | --- |
| [Wild 2](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/dataset.shtml) | PDS v2.1 offers a detailed Stardust model and a basic triaxial model. | Exact geometry/frame/coverage intake and visual qualification remain outstanding. No scene has been fabricated. |
| [Borrelly](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-5-borrelly-dem-v1.0/dataset.shtml) | DS1 stereo DEM covers visible, illuminated terrain. | A partial terrain package needs a faithful coverage presentation; it does not establish a complete nucleus by itself. |
| [Halley](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/) | PDS4 Stooke archive includes older image-derived shape models and convention caveats. | The specific Halley source, longitude convention and coverage limits need qualification before inclusion. |

A discarded intake experiment removed all PDS faces touching a poorly constrained vertex. That broke Hartley 2's visible neck and made the display misleading. The included packages instead preserve the published scientific model and expose its uncertainty categories. This decision does not claim that the entire model was measured directly.

## Review evidence

[QUALIFICATION.md](QUALIFICATION.md) records exact checks, local browser evidence and remaining gate failures. [PERFORMANCE.md](PERFORMANCE.md) records the drag workload and measured results. Each object retains its original source labels, byte/hash pins, acquisition recipe and interpretation notes beside the package.
