# Comet scenes

Ten independently selectable nucleus packages use the generic object registry. **Shadows defaults off for every comet** and remains available in Settings. The shared shell and camera remain the owners of interaction. Halley, 67P, Hartley 2 and Tempel 1 each have 1,000 prepared native PolyCSS triangles; Wild 2 has 992. Tuttle retains two separate 1,000-triangle models and displays only the selected one. Borrelly retains 994 USGS and 1,862 DLR triangles, including explicitly gridded estimated closures, with only the selected terrain bank displayed. The three lightcurve-based additions each have 800 triangles and the shared missing-imagery grid. All geometry, maps, normals and shadows are prepared before runtime.

| Object | Geometry source | What the default view represents |
| --- | --- | --- |
| [1P/Halley](../../src/planets/comet-1p/README.md) | Stooke's historical Giotto/Vega radius grid, 2,701 rows | Highly uncertain historical shape with neutral material and an illustrative fixed attitude. |
| [8P/Tuttle](../../src/planets/comet-8p/README.md) | Hubble/Spitzer contact spheres and an alternative Arecibo contact-ellipsoid model | Hubble/Spitzer is the default; Arecibo uses a separate inferred shape at the same physical scale. Both have illustrative attitudes. |
| [19P/Borrelly](../../src/planets/comet-19p/README.md) | Reviewed USGS and DLR image-plane DEMs | Registered MICAS photograph on the USGS terrain; independent terrain, Height and Difference views share the scene. |
| [67P/Churyumov–Gerasimenko](../../src/planets/comet-67p/README.md) | ESA/RMOC MTP019, 104,192 source triangles | Rosetta nucleus geometry with a neutral gray model material. The neck and non-convex topology are retained. |
| [103P/Hartley 2](../../src/planets/comet-103p/README.md) | Farnham & Thomas (2013), EPOXI PDS model, 32,040 source triangles | The published complete model, colored by its source constraint flags. The cartographic long axis is not treated as a spin axis. |
| [9P/Tempel 1](../../src/planets/comet-9p/README.md) | Farnham & Thomas (2013), combined Deep Impact/Stardust-NExT PDS model, 32,040 source triangles | The published complete model, colored by its source constraint flags. |
| [81P/Wild 2](../../src/planets/comet-81p/README.md) | Full PDS v2.1 plate model, 17,518 source triangles | Observed terrain with the published estimated ellipsoid and joining faces marked by grid texels. |

| [137P/Shoemaker–Levy 2](../../src/planets/comet-137p/README.md) | Donaldson (2025), Model 1 physical axis ratios | Smooth approximation; grid marks absent imagery. The alternative pole remains documented. |
| [143P/Kowal–Mrkos](../../src/planets/comet-143p/README.md) | Donaldson (2025), accepted Model 1 physical axis ratios | Smooth approximation with an infrared size estimate; grid marks absent imagery. |
| [162P/Siding Spring](../../src/planets/comet-162p/README.md) | Donaldson (2025), physical axis extents | Flattened approximation; grid marks absent imagery. Thickness and local shape remain uncertain. |

For Hartley 2 and Tempel 1, gray marks stereo-controlled regions, blue marks limb-silhouette constraints, and grid texels mark poorly constrained source estimates in both views. Those estimates belong to the archived model. The Shape model lens uses gray for the stronger constraints. These are inspection materials, not albedo photographs. Halley has no regional confidence flags, so it uses a visible whole-model uncertainty label.

The display does not simulate dust, a coma, jets, tails or outgassing. The PDS comet models have no invented uniform spin. All phases are explicitly arbitrary. Solar placement uses JPL Horizons osculating elements at JD 2461286.5 (3 September 2026 TT); it is not a long-term ephemeris. Independent Horizons vector checks at that epoch agree within 2 mm. At ±30 days the largest measured conic discrepancies include 329.06 km for 67P, 390.29 km for Hartley 2, 5,181.10 km for Tempel 1, and 557.99 km for Halley, and 437.44 km for Tuttle. Per-body regression guards add about 15% headroom under a separate 10,000 km nearby-placement budget. Runtime does not extrapolate the display epoch.

## Additional candidates

[CANDIDATES.md](CANDIDATES.md) records source limitations and dispositions. Wild 2 uses the archive's explicitly estimated completion; Halley uses the labelled historical model. Borrelly preserves the measured image-plane terrain and marks its estimated completion with the shared grid, alongside photography and comparison views. See [the Borrelly record](BORRELLY.md).

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

[67P Regions and Geology](67P-GEOLOGY.md) records the 26 SHAP7 regional
definitions and the ESA geological feature inventory, registered in 3D onto the
same nucleus scene. These use the existing dataset selector and shared legend.

[67P VIRTIS scientific views](67P-VIRTIS.md) documents the four MTP006 datasets, numerical units, source-to-shape transfer, concise lens factsheets and validation evidence.

[Wild 2, Tempel 1 and Hartley 2 encounter photography](ENCOUNTER-PHOTOGRAPHY.md) records the initial photographic release. [The surface-imagery pass](SURFACE-IMAGERY.md) expands those mosaics and combines Hartley’s MRI/HRI photographs into one EPOXI view.

[Tuttle](TUTTLE.md) records the sixth comet and its independent geometry/orbit checks. [The Arecibo comparison](TUTTLE-ARECIBO.md) records both datasets and the current browser, delivery and drag evidence.

[Lightcurve-based additions](LIGHTCURVE-SHAPES.md) records the three approximations, their source limitations and delivery checks.
