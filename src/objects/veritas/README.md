# (490) Veritas

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-shape"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 833](https://damit.cuni.cz/projects/damit/asteroid_models/view/833) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

[DAMIT model 833](https://damit.cuni.cz/projects/damit/asteroid_models/view/833), version 2016-01-04, from Hanuš et al. (2016), is a convex lightcurve inversion mesh. The original 1019 vertices and 2034 triangular faces are preserved as the source input. Convex lightcurve inversion model; large-scale shape is inferred from disk-integrated brightness.

Concavities, craters, surface texture and exact current rotation phase are not resolved.

Adopted diameter: **118.803 ± 1.83 km**, meaning **effective body diameter**, from [Masiero et al. (2012), PDS NEOWISE Diameters and Albedos V2.0, reference codeMas12](https://doi.org/10.1088/2041-8205/759/1/L8). The reference-sphere radius is 59.4015 km. The quoted statistical error excludes the approximately 20% survey systematic floor (about 23.7606 km), shape/orientation effects and rotational sampling limitations.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

<a id="provenance"></a>

The [veritas validation record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

Checked 2026-09-08. Original shape, IAUspin, model metadata, citations, sizing inputs and format documentation are pinned by exact bytes and SHA-256 in the [input manifest](source/manifest.json). Derived source notes retain the physical sizing assumption and pole alternatives.

## Known problems

Uniformly scale the independently inferred convex shape to the reported effective thermal diameter. This does not establish a measured volume or shape-matched thermophysical calibration; quoted catalog errors exclude shape/orientation and survey systematic uncertainty.

The Shape view uses the shared normal grid because the source release provides no registered surface imagery. The grid is a coordinate guide, not regolith, measured albedo or an optical photograph. Elevation is radius on this scaled shape minus the reference-sphere radius, using the original surface for the established source-to-face transfer.

It is model-derived radial relief, not an independent DEM, gravitational height or resolved cratering. Its physical units inherit the scale uncertainty. Directional lighting is illustrative for the chosen model attitude; Shadows is off by default.

Published alternate pole solutions remain plausible: model 834: λ=231°, β=43°, P=7.92812 h. The selected first archived solution is not asserted to be uniquely correct.

The displayed phase is not propagated from the historical source epoch and does not claim exact current attitude.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected shape</summary>

Model publication: [New and updated convex shape models of asteroids based on optical data from a large collaboration network](https://damit.cuni.cz/projects/damit/references/view/161).

The refreshed DAMIT search on 2026-09-08 found no size-calibrated same-body mesh. A published physical size is therefore applied through the existing `metersPerUnit` source conversion, before the established 800-face meshoptimizer/PolyCSS raster preparation.

</details>

<a id="physical-scale-and-uncertainty"></a>

<details>
<summary>Physical scale and uncertainty</summary>

The source's signed tetrahedral volume integral is 1.00000018535 source units cubed, giving volume-equivalent diameter 1.24070105845 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 95754.7341405669`. The raw mesh coordinates and connectivity are unchanged. Computed source topology has positive volume, consistent winding, each edge used twice, and Euler characteristic 2. This validates interpretation and source integrity; it does not establish the physical accuracy of the inversion.

The exact original size record (where tabulated), its complete field definitions, parent-file identity, source URL, byte offset and line number are retained in the intake evidence. Multiple infrared epochs remain separate; they are not averaged into a falsely precise physical volume.

</details>

<a id="orientation-and-time"></a>

<details>
<summary>Orientation and time</summary>

DAMIT metadata report J2000 ecliptic pole λ=56°, β=34°, and rounded sidereal period 7.92811 h. The original IAUspin file uses equatorial pole α=41°, δ=52°, dW/dt=1089.793154°/day, W0=277.3° at JD 2451545.0. These are different frame conventions. The existing recipe uses the paired model-record ecliptic pole and period, with arbitrary display phase.

IAUspin is retained as provenance and as an independent frame/rate consistency check; its period agrees within the printed precision of the model record. Model longitude zero is an inversion/display convention, not an observed landmark.

</details>

<a id="views-and-source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.
