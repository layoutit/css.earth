# Thisbe

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-model"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5926](https://damit.cuni.cz/projects/damit/asteroid_models/view/5926) |
| SPHERE photograph | [30 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 3 nights from 2018-07-08 to 2018-07-14](https://observations.lam.fr/astero/Data/88Thisbe/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/88_Thisbe_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/88_Thisbe_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.30](https://doi.org/10.1051/0004-6361/202141781) |

[Original DAMIT model 5926](https://damit.cuni.cz/projects/damit/asteroid_models/view/5926), version 2021-11-12, is a calibrated nonconvex reconstruction. The model page explicitly marks calibrated size = yes; DAMIT documentation defines these coordinates in kilometers. The original model page, metadata, referenced bibliographic records, frame documentation and available IAUspin file are checked in and pinned.

The saved HTML is evidence only; its viewer scripts are never evaluated or included at runtime.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.30](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2018-07-08 06:47:58 | 0.975 | 0.969 | 0.977 | -10° | -1°, -1° | 97.9° against 95.9° |
| 2018-07-08 08:03:06 | 0.974 | 0.973 | 0.976 | 0° | -1.5°, 1.5° | 97.9° against 95.9° |
| 2018-07-10 03:09:47 | 0.975 | 0.967 | 0.979 | 0° | -1.5°, 4° | 98.0° against 95.9° |
| 2018-07-10 04:29:56 | 0.972 | 0.968 | 0.977 | 0° | -1.5°, 1.5° | 98.0° against 96.0° |
| 2018-07-10 05:32:34 | 0.978 | 0.970 | 0.979 | 0° | -1°, 1° | 98.0° against 96.0° |
| 2018-07-14 01:11:36 | 0.975 | 0.971 | 0.979 | 0° | -2°, -2° | 98.0° against 96.0° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 30 native frames after the centre fit is 1.541 px at our phase, the lowest of a ±30° sweep.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 30 | 15 | 7.64° | 3.85° | 6.60° | its other 30 frames | 0 of 30 | — | 13 of 30, -1.00° | — | ×1.13 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.30](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

The [asteroid validation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-validation.md) records the earlier source, preparation and browser checks. Some raw captures cited there have local `output/` paths.

Independent 8192 area-stratified samples in each direction measured nearest-triangle distances: p95 863.932 m, maximum 1920.115 m. These are sampled distances, not exhaustive geometric bounds. All source face centroids and 8192 sphere directions were checked for radial ambiguity; no second radial intersection was found.

Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they are geometry inspection, not browser pixel parity.

## Known problems

Shape uses the shared missing-imagery grid. DAMIT's viewer illustrations are not source surface maps; no albedo, photographic color, regolith or composition is inferred. Elevation shows the radius of the original model minus a 109 km sphere, on a -20 to 20 km legend.

This is a second display of the same reconstruction, not an independent measurement or height above a gravitational equipotential. A 4096 × 2048 display map does not add observational detail. The existing scientific recipe samples 721 × 361 directions, then applies its documented cartographic relief.

Prime-meridian display phase is explicitly arbitrary; the available IAUspin file is preserved but no absolute rotational ephemeris is claimed.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Thisbe from 16° north, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected model</summary>

[Original counted triangle table](https://damit.cuni.cz/projects/damit/stored_files/open/64864/shape.txt) has 578 vertices and 1152 triangles. It is consumed without conversion by the existing PDS plate-table reader because its count/XYZ/one-based-triangle layout is identical. This is a DAMIT dataset, not a PDS release.

Its vertices, outward winding and co-rotating frame remain unchanged. Positive Z is the spin pole and positive X defines the meridian.

The record gives diameter 218 km, period 6.041319 h and ecliptic J2000 pole (74°, 63°). The original mesh has measured volume-equivalent radius 108.972342 km and Cartesian extents 250.704 × 231.328 × 197.684 km. The rounded catalog diameter is used as the reference-sphere scale; the original coordinates are not rescaled.

The selected paired DAMIT model record provides a valid pole. The separate MPCD survey table reports an impossible latitude for Thisbe, so that table is not used to orient this mesh. No value is wrapped or reinterpreted to repair that source.

- [Vernazza et al. (2021), VLT/SPHERE imaging survey of the largest main-belt asteroids: Final results and synthesis](https://ui.adsabs.harvard.edu/abs/2021A&A...654A..56V) — selected model publication.

</details>

<a id="appearance-and-preparation"></a>

<details>
<summary>Appearance and preparation</summary>

The existing source-meshoptimizer recipe reduces the original connected surface to 800 triangles. Meshoptimizer 1.2.0 reports 2008.8 m estimated error, below the authored 2100 m stopping threshold; this estimate is not a Hausdorff bound. All models use 800 native PolyCSS u raster leaves, 128 × 128 px per leaf in a 2048 × 6400 atlas, with lighting and texels prepared ahead of runtime.

The surface remains one closed component with Euler characteristic 2.

</details>

<a id="frame-source-closure-and-delivery"></a>

<details>
<summary>Frame, source closure and delivery</summary>

The source ecliptic J2000 pole is converted with obliquity 23.439291111° for the existing observed-pole recipe.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The conic is a fixed-epoch display approximation, not a long-term perturbation ephemeris. TDB is approximated as TT within 2 ms.

GM is G times the measured mass in [Vernazza et al. (2021), Table 1](https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=J/A%2BA/654/A56) (11.60 ± 2.20 × 10^18 kg), with G = 6.6743 × 10^-20 km³ kg⁻¹ s⁻²; it is not inferred from an assumed density.

[source/manifest.json](source/manifest.json) pins every consumed file. The original mesh is checked in and also restorable through source/preparation/acquisition.json, along with the Inter font. Original model-record snapshots and supporting documents remain checked in because server-generated HTML contains changing timestamps.

The pinned context PNG is reproduced by the existing radial snapshot recipe.

</details>
