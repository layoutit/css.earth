# (127) Johanna

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 444](https://damit.cuni.cz/projects/damit/asteroid_models/view/444) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **444**, version **2012-07-30**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2012); model 444, version 2012-07-30.

Convex light-curve reconstruction with approximate thermal size: 114.19 km effective diameter (catalog ±1.52 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [johanna results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **444.67 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

AKARI’s thermal diameter sets an approximate mesh volume scale. The inferred shape does not resolve craters or concavities. Marciniak2012 linked archive models444/445 preserve two poles. A published occultation comparison reports approximate equivalent-sphere sizes116±14/108±10 km, but full primary PDF retrieval is blocked (A&A/DTU403); its exact size-to-mesh interpretation is left unresolved, so the pinned AKARI scale remains an explicit approximation.

ISAM is also currently unavailable. No claim that a better calibration does not exist is made.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 445, pole ['261', '-70'], [Model 445](https://damit.cuni.cz/projects/damit/asteroid_models/view/445)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 1.0000000380963694 source units³; an independent triangle-centroid divergence sum gives 1.0000000380963694. The existing recipe applies one uniform scale of 92.036679445815906 km per source unit so its volume-equivalent diameter is 114.19 km.

No unit-volume assumption is made. Radius above a 57.095 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (98°, -60°), with sidereal period 12.7995 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

[Model fields and mesh measurements](source/reference/damit-model.json).

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/444) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1730/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Marciniak et al. (2012), Photometry and models of selected main belt asteroids IX. Introducing Interactive Service for Asteroid Models (ISAM)](https://ui.adsabs.harvard.edu/abs/2012A%26A...545A.131M) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 114.19 ± 1.52 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1141.9 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
