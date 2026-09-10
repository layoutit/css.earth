# (213) Lilaea

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 9003](https://damit.cuni.cz/projects/damit/asteroid_models/view/9003) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **9003**, version **2022-11-29**. DAMIT, Astronomical Institute of Charles University; Ďurech & Hanuš (2023); model 9003, version 2022-11-29.

Convex light-curve reconstruction with approximate thermal size: 76.31 km effective diameter (catalog ±0.97 km; additional shape and thermal-model uncertainty). Thermal size supplies a volume-scale approximation. The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [lilaea results](../../../docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **129.35 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Gaia DR3 inversion provides a low-resolution convex shape from sparse disk-integrated observations. The linked CDS release provides spin parameters and observation counts, not an imagery product or independent size calibration. The selected DAMIT release has one pole solution.

The thermal scale is approximate. Convex inversion supplies broad outline without resolved craters, concavities, reflectance or regolith texture.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. The survey found no alternative archive solution for this target.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 574 vertices and 1144 triangles. Its signed tetrahedral volume is 1.0000001088520782 source units³; an independent triangle-centroid divergence sum gives 1.0000001088520782. The existing recipe applies one uniform scale of 61.505550773829476 km per source unit so its volume-equivalent diameter is 76.31 km.

No unit-volume assumption is made. Radius above a 38.155 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (173°, 76°), with sidereal period 12.0395 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/9003) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/84844/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Ďurech & Hanuš (2023)](https://damit.cuni.cz/projects/damit/references/view/665) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 76.31 ± 0.97 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech & Hanuš (2023), A&A 675, A24](https://arxiv.org/pdf/2305.10798) — retained primary publication; see the body-specific selection and calibration above.
- [Usui et al. (2011), PASJ 63, 1117–1138](https://arxiv.org/pdf/1106.1948) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 763.1 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
