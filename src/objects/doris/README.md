# Doris

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-model"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1845](https://damit.cuni.cz/projects/damit/asteroid_models/view/1845) |
| SPHERE photograph | [10 deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, 2017-11-02 and 2017-11-29](https://observations.lam.fr/astero/Data/48Doris/Deconv/) on the [ADAM reconstruction](https://observations.lam.fr/astero/3Dshape/48_Doris_adam.obj) |
| Photograph cameras | [Release rotation record](https://observations.lam.fr/astero/3Dshape/48_Doris_param.txt), read latitude-first, and JPL Horizons geometry from Paranal |
| Photograph registration | [Vernazza et al. (2021), Figure B.25](https://doi.org/10.1051/0004-6361/202141781) |

[Original DAMIT model 1845](https://damit.cuni.cz/projects/damit/asteroid_models/view/1845), version 2017-09-21, is a calibrated nonconvex reconstruction. The model page explicitly marks calibrated size = yes; DAMIT documentation defines these coordinates in kilometers. The original model page, metadata, referenced bibliographic records, frame documentation and available IAUspin file are checked in and pinned.

The saved HTML is evidence only; its viewer scripts are never evaluated or included at runtime.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

### SPHERE photograph

<!-- published-comparison:begin -->
Measured by `tools/objects/published-comparison.mts` against [Figure B.25](https://doi.org/10.1051/0004-6361/202141781), the survey's comparison of these frames with its models. The numbers are read from [`evidence/published-comparison.json`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.

| Figure column | Overlap with the paper's model | With the paper's photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure's |
| --- | --- | --- | --- | --- | --- | --- |
| 2017-11-02 03:13:39 | 0.966 | 0.949 | 0.967 | 0° | 0.5°, 4.5° | 36.8° against 35.1° |
| 2017-11-29 00:34:37 | 0.956 | 0.964 | 0.968 | -10° | -2°, -1° | 34.5° against 32.6° |

Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the 10 native frames after the centre fit is 3.027 px at our phase; the lowest of a ±30° sweep is 2.639 px at -14°.
<!-- published-comparison:end -->

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 10 | 5 | 3.63° | 0.61° | 3.58° | its other 10 frames | 0 of 10 | — | 6 of 10, 3.00° | — | ×1.05 | conflict |

`zimpol` ships on its paper’s comparison, [Figure B.25](https://doi.org/10.1051/0004-6361/202141781), measured in [`evidence/published-comparison.json`](evidence/published-comparison.json); its verdict is reported, not a gate.

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

### Shape

The [asteroid validation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-validation.md) records the earlier source, preparation and browser checks. Some raw captures cited there have local `output/` paths.

Independent 8192 area-stratified samples in each direction measured nearest-triangle distances: p95 0.000 m, maximum 0.000 m. These are sampled distances, not exhaustive geometric bounds. All source face centroids and 8192 sphere directions were checked for radial ambiguity; no second radial intersection was found.

Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they are geometry inspection, not browser pixel parity.

## Known problems

Shape uses the shared missing-imagery grid. DAMIT's viewer illustrations are not source surface maps; no albedo, photographic color, regolith or composition is inferred. Elevation shows the radius of the original model minus a 105 km sphere, on a -30 to 30 km legend.

This is a second display of the same reconstruction, not an independent measurement or height above a gravitational equipotential. A 4096 × 2048 display map does not add observational detail. The existing scientific recipe samples 721 × 361 directions, then applies its documented cartographic relief.

Prime-meridian display phase is explicitly arbitrary; the available IAUspin file is preserved but no absolute rotational ephemeris is claimed.

The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels, averaged where frames overlap, each fading out toward its disc edge. It is not albedo or colour. The frames see Doris from 17° to 19° north, so surface the survey did not see keeps the missing-imagery grid.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected model</summary>

[Original counted triangle table](https://damit.cuni.cz/projects/damit/stored_files/open/3525/shape.txt) has 402 vertices and 800 triangles. It is consumed without conversion by the existing PDS plate-table reader because its count/XYZ/one-based-triangle layout is identical. This is a DAMIT dataset, not a PDS release.

Its vertices, outward winding and co-rotating frame remain unchanged. Positive Z is the spin pole and positive X defines the meridian.

The record gives diameter 210 km, period 11.8901 h and ecliptic J2000 pole (298°, 59°). The original mesh has measured volume-equivalent radius 105.053827 km and Cartesian extents 257.119 × 227.828 × 181.467 km. The rounded catalog diameter is used as the reference-sphere scale; the original coordinates are not rescaled.

- [Viikinkoski et al. (2017), Adaptive optics and lightcurve data of asteroids: twenty shape models and information content analysis](https://ui.adsabs.harvard.edu/abs/2017A%26A...607A.117V) — selected model publication.

</details>

<a id="appearance-and-preparation"></a>

<details>
<summary>Appearance and preparation</summary>

The original already contains 800 triangles. Meshoptimizer performs no edge collapse: all source geometry is retained, with zero estimated simplification error. All models use 800 native PolyCSS u raster leaves, 128 × 128 px per leaf in a 2048 × 6400 atlas, with lighting and texels prepared ahead of runtime.

The surface remains one closed component with Euler characteristic 2.

</details>

<a id="frame-source-closure-and-delivery"></a>

<details>
<summary>Frame, source closure and delivery</summary>

The source ecliptic J2000 pole is converted with obliquity 23.439291111° for the existing observed-pole recipe.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The conic is a fixed-epoch display approximation, not a long-term perturbation ephemeris. TDB is approximated as TT within 2 ms.

GM is G times the measured mass in [Vernazza et al. (2021), Table 1](https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=J/A%2BA/654/A56) (6.90 ± 2.90 × 10^18 kg), with G = 6.6743 × 10^-20 km³ kg⁻¹ s⁻²; it is not inferred from an assumed density.

[source/manifest.json](source/manifest.json) pins every consumed file. The original mesh is checked in and also restorable through source/preparation/acquisition.json, along with the Inter font. Original model-record snapshots and supporting documents remain checked in because server-generated HTML contains changing timestamps.

The pinned context PNG is reproduced by the existing radial snapshot recipe.

</details>
