# (204) Kallisto

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 4787](https://damit.cuni.cz/projects/damit/asteroid_models/view/4787) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **4787**, version **2019-10-23**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2020); model 4787, version 2019-10-23.

Convex light-curve reconstruction with approximate thermal size: 51.03 km effective diameter (catalog ±0.6 km; additional shape and thermal-model uncertainty). Thermal size supplies a volume-scale approximation. The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [kallisto results](../../../docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **45.86 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

ATLAS2015–2018 photometry gives 368 orange and 127 cyan measurements, with period located by the ellipsoid search and a subsequently reconstructed convex shape. Both mirror poles remain; model 4787 is selected without claiming that mirror 4788 is false.

No calibrated volume or resolved terrain is supplied. The thermal scale is approximate. Convex inversion supplies broad outline without resolved craters, concavities, reflectance or regolith texture.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 4788, pole ['15', '30'], [Model 4788](https://damit.cuni.cz/projects/damit/asteroid_models/view/4788)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 564 vertices and 1124 triangles. Its signed tetrahedral volume is 0.99999995449706969 source units³; an independent triangle-centroid divergence sum gives 0.99999995449706969. The existing recipe applies one uniform scale of 41.129975330575036 km per source unit so its volume-equivalent diameter is 51.03 km.

No unit-volume assumption is made. Radius above a 25.515 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (188°, 14°), with sidereal period 19.487 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/4787) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/54276/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Ďurech et al. (2020)](https://damit.cuni.cz/projects/damit/references/view/658) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 51.03 ± 0.6 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2020), A&A 643, A59](https://arxiv.org/pdf/2010.01820) — retained primary publication; see the body-specific selection and calibration above.
- [Usui et al. (2011), PASJ 63, 1117–1138](https://arxiv.org/pdf/1106.1948) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 510.3 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
