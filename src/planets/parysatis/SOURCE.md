# (888) Parysatis: sources and interpretation

## Selected shape

[DAMIT model 5820](https://damit.cuni.cz/projects/damit/asteroid_models/view/5820), version 2019-10-23, from Ďurech et al. (2020), is a convex lightcurve inversion mesh. The original 574 vertices and 1144 triangular faces are preserved as the source input. Convex lightcurve inversion model; large-scale shape is inferred from disk-integrated brightness. Concavities, craters, surface texture and exact current rotation phase are not resolved.

Model publication: [Asteroid models reconstructed from ATLAS photometry](https://damit.cuni.cz/projects/damit/references/view/658).

The refreshed DAMIT search on 2026-09-08 found no size-calibrated same-body mesh. A published physical size is therefore applied through the existing `metersPerUnit` source conversion, before the established 800-face meshoptimizer/PolyCSS raster preparation. This adds no new geometry or rendering technique.

## Physical scale and uncertainty

Adopted diameter: **44.749 ± 0.37 km**, meaning **effective body diameter**, from [Masiero et al. (2014), PDS NEOWISE Diameters and Albedos V2.0, reference codeMas14](https://doi.org/10.1088/0004-637X/791/2/121). The reference-sphere radius is 22.3745 km. The quoted statistical error excludes the approximately 10% survey systematic floor (about 4.4749 km), shape/orientation effects and rotational sampling limitations.

Uniformly scale the independently inferred convex shape to the reported effective thermal diameter. This does not establish a measured volume or shape-matched thermophysical calibration; quoted catalog errors exclude shape/orientation and survey systematic uncertainty.

The source's signed tetrahedral volume integral is 1.00000017882 source units cubed, giving volume-equivalent diameter 1.24070105575 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 36067.5118252517`. The raw mesh coordinates and connectivity are unchanged. Computed source topology has positive volume, consistent winding, each edge used twice, and Euler characteristic 2. This validates interpretation and source integrity; it does not establish the physical accuracy of the inversion.

The exact original size record (where tabulated), its complete field definitions, parent-file identity, source URL, byte offset and line number are retained in the intake evidence. Multiple infrared epochs remain separate; they are not averaged into a falsely precise physical volume.

## Orientation and time

DAMIT metadata report J2000 ecliptic pole λ=263°, β=-47°, and rounded sidereal period 5.93333 h. The original IAUspin file uses equatorial pole α=255°, δ=-70°, dW/dt=1456.181386°/day, W0=122.9° at JD 2451545.0. These are different frame conventions. The existing recipe uses the paired model-record ecliptic pole and period, with arbitrary display phase. IAUspin is retained as provenance and as an independent frame/rate consistency check; its period agrees within the printed precision of the model record. The displayed phase is not propagated from the historical source epoch and does not claim exact current attitude. Model longitude zero is an inversion/display convention, not an observed landmark.

Published alternate pole solutions remain plausible: model 5821: λ=127°, β=-62°, P=5.93334 h. The selected first archived solution is not asserted to be uniquely correct.

## Views and source survey

The Shape view uses the shared normal grid because the source release provides no registered surface imagery. The grid is a coordinate guide, not regolith, measured albedo or an optical photograph. Elevation is radius on this scaled shape minus the reference-sphere radius, using the original surface for the established source-to-face transfer. It is model-derived radial relief, not an independent DEM, gravitational height or resolved cratering. Its physical units inherit the scale uncertainty. Directional lighting is illustrative for the chosen model attitude; Shadows is off by default.

| Source candidate | Disposition | Reason |
| --- | --- | --- |
| DAMIT model search | included | Original body-specific convex shape and spin. Current search found no size-calibrated model. |
| SBDB physical size and cited radiometry | included-qualified | Effective spherical diameter for approximate uniform physical scaling; retains quoted error and method limitations. |
| Optical surface / resolved DEM / composition map | excluded | No registered surface map is supplied by the selected lightcurve inversion release. Shared grid and source-shape radial elevation are appropriate; no fabricated texture. |

No optical surface texture, composition map, temperature map, density or missing rotation period is invented. The model page and publication describe disk-integrated inversion data; such photometry cannot be repackaged as registered surface texels. Any unresolved complementary release remains a future source candidate rather than a fabricated view.

## Provenance

Checked 2026-09-08. Original shape, IAUspin, model metadata, citations, sizing inputs and format documentation are pinned by exact bytes and SHA-256 in the lane intake. Derived source notes retain the physical sizing assumption and pole alternatives. Runtime/prepared fit, source restoration, visual and installation qualification are separate work recorded by the integration owner.
