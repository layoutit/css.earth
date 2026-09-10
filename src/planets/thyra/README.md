# (115) Thyra

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 154](https://damit.cuni.cz/projects/damit/asteroid_models/view/154) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **154**, version **2009-02-26**. DAMIT, Astronomical Institute of Charles University; T. Michalowski (2004), M. Delbo and P. Tanga (2009); model 154, version 2009-02-26.

Convex light-curve reconstruction with a published 90–94 km diameter fit range; the archive mesh uses 92 km. Unusual scattering parameters make its vertical shape uncertain. The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [thyra results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **347.33 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The archive warns that unusual Hapke parameters were needed to keep the shape from becoming too high. This limits confidence in the vertical dimension. Delbo and Tanga (2009) give a 90–94 km thermophysical size range for this pole family, represented in DAMIT as 92 ± 2 km.

The material roughness is not constrained; no Hapke-derived texture is synthesized.

DAMIT represents the published 90–94 km thermophysical fit range as 92±2 km. This is a fit range, not an independently stated one-sigma Gaussian confidence interval or a local shape-accuracy bound.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. The survey found no alternative archive solution for this target.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1021 vertices and 2038 triangles. Its signed tetrahedral volume is 407720.05092013458 source units³; an independent triangle-centroid divergence sum gives 407720.05092013447. The existing recipe applies one uniform scale of 1.0000000265320557 km per source unit so its volume-equivalent diameter is 92 km.

No unit-volume assumption is made. Radius above a 46 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (35°, 33°), with sidereal period 7.23996 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/154) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/369/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [T. Michalowski (2004), Photometry and models of selected main-belt asteroids (I): 52 Europa, 115 Thyra, and 382 Dodona](https://ui.adsabs.harvard.edu/abs/2004A&A...416..353M/abstract) — original model publication record.
- [M. Delbo and P. Tanga (2009), Thermal inertia of main belt asteroids smaller than 100 km from IRAS data](https://ui.adsabs.harvard.edu/abs/2009P%26SS...57..259D) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 80.65 ± 0.88 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Delbo and Tanga (2009), Planetary and Space Science 57, 259–265](https://arxiv.org/pdf/0808.0869) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 920 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
