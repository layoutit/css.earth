# (800) Kressmannia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-shape"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 382](https://damit.cuni.cz/projects/damit/asteroid_models/view/382) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

[DAMIT model 382](https://damit.cuni.cz/projects/damit/asteroid_models/view/382), version 2011-04-21, from Hanuš (2011), is a convex lightcurve inversion mesh. The original 1022 vertices and 2040 triangular faces are preserved as the source input. Convex lightcurve inversion model; large-scale shape is inferred from disk-integrated brightness.

Concavities, craters, surface texture and exact current rotation phase are not resolved.

Adopted diameter: **15.429 ± 0.325 km**, meaning **effective body diameter**, from [Masiero et al. (2014), PDS NEOWISE Diameters and Albedos V2.0, reference codeMas14](https://doi.org/10.1088/0004-637X/791/2/121). The reference-sphere radius is 7.7145 km. The quoted statistical error excludes the approximately 10% survey systematic floor (about 1.5429 km), shape/orientation effects and rotational sampling limitations.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

<a id="provenance"></a>

The [kressmannia validation record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

Checked 2026-09-08. Original shape, IAUspin, model metadata, citations, sizing inputs and format documentation are pinned by exact bytes and SHA-256 in the [input manifest](source/manifest.json). Derived source notes retain the physical sizing assumption and pole alternatives.

## Known problems

Uniformly scale the independently inferred convex shape to the reported effective thermal diameter. This does not establish a measured volume or shape-matched thermophysical calibration; quoted catalog errors exclude shape/orientation and survey systematic uncertainty.

The Shape view uses the shared normal grid because the source release provides no registered surface imagery. The grid is a coordinate guide, not regolith, measured albedo or an optical photograph. Elevation is radius on this scaled shape minus the reference-sphere radius, using the original surface for the established source-to-face transfer.

It is model-derived radial relief, not an independent DEM, gravitational height or resolved cratering. Its physical units inherit the scale uncertainty. Directional lighting is illustrative for the chosen model attitude; Shadows is off by default.

Published alternate pole solutions remain plausible: model 383: λ=172°, β=34°, P=4.46096 h. The selected first archived solution is not asserted to be uniquely correct.

The displayed phase is not propagated from the historical source epoch and does not claim exact current attitude.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected shape</summary>

Model publication: [A study of asteroid pole-latitude distribution based on an extended set of shape models derived by the lightcurve inversion method](https://damit.cuni.cz/projects/damit/references/view/141).

The refreshed DAMIT search on 2026-09-08 found no size-calibrated same-body mesh. A published physical size is therefore applied through the existing `metersPerUnit` source conversion, before the established 800-face meshoptimizer/PolyCSS raster preparation.

</details>

<a id="physical-scale-and-uncertainty"></a>

<details>
<summary>Physical scale and uncertainty</summary>

The source's signed tetrahedral volume integral is 0.999999781667 source units cubed, giving volume-equivalent diameter 1.2407008915 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 12435.7128343022`. The raw mesh coordinates and connectivity are unchanged. Computed source topology has positive volume, consistent winding, each edge used twice, and Euler characteristic 2. This validates interpretation and source integrity; it does not establish the physical accuracy of the inversion.

The exact original size record (where tabulated), its complete field definitions, parent-file identity, source URL, byte offset and line number are retained in the intake evidence. Multiple infrared epochs remain separate; they are not averaged into a falsely precise physical volume.

</details>

<a id="orientation-and-time"></a>

<details>
<summary>Orientation and time</summary>

DAMIT metadata report J2000 ecliptic pole λ=345°, β=37°, and rounded sidereal period 4.460963 h. The original IAUspin file uses equatorial pole α=331°, δ=28°, dW/dt=1936.801538°/day, W0=110° at JD 2451545.0. These are different frame conventions. The existing recipe uses the paired model-record ecliptic pole and period, with arbitrary display phase.

IAUspin is retained as provenance and as an independent frame/rate consistency check; its period agrees within the printed precision of the model record. Model longitude zero is an inversion/display convention, not an observed landmark.

</details>

<a id="views-and-source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.
