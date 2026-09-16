# (63) Ausonia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5924](https://damit.cuni.cz/projects/damit/asteroid_models/view/5924) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **5924**, version **2021-11-12**. DAMIT, Astronomical Institute of Charles University; Vernazza et al. (2021); model 5924, version 2021-11-12.

Nonconvex model constrained by resolved imaging, 93 ± 3 km volume-equivalent diameter in the selected archive record. Grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [ausonia results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids/summary.json) record a maximum sampled source-to-display distance of **569.97 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from [`prepared/surfaces.json`](prepared/surfaces.json), not typed.

| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `zimpol` | 16 | 10 | 2.51° | 1.60° | 1.93° | its other 16 frames | 0 of 16 | — | 5 of 16, -8.00° |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset.
<!-- registration-report:end -->

## Known problems

The original mesh is uniformly scaled to the selected archive record’s declared volume-equivalent diameter. Published ensemble estimates can differ from this archived solution. Original coordinates and connectivity are retained; no albedo, craters or regolith are inferred.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 140, pole ['120', '-15'], [Model 140](https://damit.cuni.cz/projects/damit/asteroid_models/view/140)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 578 vertices and 1152 triangles. Its signed tetrahedral volume is 423136.43878432951 source units³; an independent triangle-centroid divergence sum gives 423136.43878432951. The existing recipe applies one uniform scale of 0.9984408632995786 km per source unit so its volume-equivalent diameter is 93 km.

No unit-volume assumption is made. Radius above a 46.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (121°, -27°), with sidereal period 9.29759 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. This model disables the existing optional RegularizeLight flag: regularization exceeded the source-transfer allowance in one sampled patch, whereas the position-error reduction preserves 800 faces within the sampled allowance.

The error allowance is 930 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
