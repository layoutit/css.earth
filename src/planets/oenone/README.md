# (215) Oenone

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 16312](https://damit.cuni.cz/projects/damit/asteroid_models/view/16312) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **16312**, version **2025-07-15**. DAMIT, Astronomical Institute of Charles University; Choukroun et al. (2025); model 16312, version 2025-07-15.

Convex CITPM shape; 37 ± 2 km volume-equivalent thermal size. Occultations give 46 ± 1 km for a separate optical-only shape. The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [oenone results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **71.83 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Choukroun2025 Table4 explicitly defines D as the equivalent-volume sphere diameter, and the unchanged CITPM mesh independently yields 37 km. Its pole (45,+85) identifies Table4 pole1. The 46±1 km occultation comment belongs to the paper’s separate lightcurve-only shape (section4.2); that shape is explicitly less smooth and is not interchangeable with this CITPM mesh.

Both mirror poles fit the occultation similarly; select model16312 as pole1 without rejecting4825. The thermal/occultation size discrepancy remains visible rather than transferring the other mesh’s diameter.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 4825, pole ['233', '85'], [Model 4825](https://damit.cuni.cz/projects/damit/asteroid_models/view/4825)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 574 vertices and 1144 triangles. Its signed tetrahedral volume is 26521.847920031152 source units³; an independent triangle-centroid divergence sum gives 26521.847920031152. The existing recipe applies one uniform scale of 1.0000000108130913 km per source unit so its volume-equivalent diameter is 37 km.

No unit-volume assumption is made. Radius above a 18.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (45°, 85°), with sidereal period 27.9077 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

[Model fields and mesh measurements](source/reference/damit-model.json).

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/16312) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/129887/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Choukroun et al. (2025), Asteroid sizes determined with thermophysical model and stellar occultations](https://ui.adsabs.harvard.edu/abs/2025A&A...698A.298C) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 35.92 ± 0.41 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Choukroun et al. (2025), A&A 698, A298](https://arxiv.org/pdf/2505.09437) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 370 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
