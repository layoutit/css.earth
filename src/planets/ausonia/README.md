# (63) Ausonia

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5924](https://damit.cuni.cz/projects/damit/asteroid_models/view/5924) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **5924**, version **2021-11-12**. DAMIT, Astronomical Institute of Charles University; Vernazza et al. (2021); model 5924, version 2021-11-12.

Nonconvex model constrained by resolved imaging, 93 ± 3 km volume-equivalent diameter in the selected archive record. Grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [ausonia results](../../../docs/evidence/main-belt-asteroids/summary.json) record a maximum sampled source-to-display distance of **569.97 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

The original mesh is uniformly scaled to the selected archive record’s declared volume-equivalent diameter. Published ensemble estimates can differ from this archived solution. Original coordinates and connectivity are retained; no albedo, craters or regolith are inferred.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 140, pole ['120', '-15'], [Model 140](https://damit.cuni.cz/projects/damit/asteroid_models/view/140)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 578 vertices and 1152 triangles. Its signed tetrahedral volume is 423136.43878432951 source units³; an independent triangle-centroid divergence sum gives 423136.43878432951. The existing recipe applies one uniform scale of 0.9984408632995786 km per source unit so its volume-equivalent diameter is 93 km.

No unit-volume assumption is made. Radius above a 46.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (121°, -27°), with sidereal period 9.29759 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/5924) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/64524/shape.txt) — included unchanged. Resolved-imaging-constrained nonconvex geometry; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Vernazza et al. (2021)](https://damit.cuni.cz/projects/damit/references/view/660) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the selected archive model has a physical size calibration. Its fitted nonrotating-sphere diameter is 87.47 ± 1.13 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. 2017](https://arxiv.org/abs/1702.01996), [Viikinkoski et al. 2017](https://arxiv.org/abs/1708.05191), and [Vernazza et al. 2021](https://damit.cuni.cz/projects/damit/references/view/660) — resolved-model releases surveyed; when present in this target’s archive they are preferred over an older convex model. Their disk images constrain geometry but are not registered global reflectance mosaics.
- [Hanuš et al. 2018](https://arxiv.org/abs/1803.06116) and [occultation dimensions](https://www.asteroidoccultation.com/observations/Asteroid_Dimensions_from_Occultations.html) — size comparison candidates; an independent fit or occultation ellipsoid is not silently equated with this mesh’s volume.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. This model disables the existing optional RegularizeLight flag: regularization exceeded the source-transfer allowance in one sampled patch, whereas the position-error reduction preserves 800 faces within the sampled allowance.

The error allowance is 930 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
