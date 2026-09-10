# (173) Ino

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5913](https://damit.cuni.cz/projects/damit/asteroid_models/view/5913) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **5913**, version **2021-11-12**. DAMIT, Astronomical Institute of Charles University; Vernazza et al. (2021); model 5913, version 2021-11-12.

ADAM nonconvex reconstruction constrained by VLT/SPHERE images. Selected archive volume-equivalent diameter: 144 ±3 km. The grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [ino results](../../../docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **951.06 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

The pinned mesh is an inverse model, not a directly sampled surface. No registered reflectance mosaic is supplied by this release; a neutral grid must mark unavailable imagery. Fine-scale craters, regolith and albedo are unresolved. Absolute rotational phase is illustrative.

Select Vernazza et al. (2021) ADAM model 5913 constrained by VLT/SPHERE images. DAMIT D144 ±3 km differs from the publication summary145 ±3 km because the summary can average ADAM/MPCD outputs when coverage exceeds80%; the exact selected mesh has raw volume diameter144.329.

Keep the archive ADAM model separate from MPCD refinement. No albedo map is inferred from deconvolved disk images.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. The survey found no alternative archive solution for this target.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1766 vertices and 3528 triangles. Its signed tetrahedral volume is 1574200.8917261746 source units³; an independent triangle-centroid divergence sum gives 1574200.8917261746. The existing recipe applies one uniform scale of 0.99771993137968151 km per source unit so its volume-equivalent diameter is 144 km.

No unit-volume assumption is made. Radius above a 72 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (28°, -17°), with sidereal period 6.11094 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/5913) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/63475/shape.txt) — included unchanged. ADAM nonconvex reconstruction constrained by VLT/SPHERE images; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Vernazza et al. (2021)](https://damit.cuni.cz/projects/damit/references/view/660) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 160.61 ± 3.05 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Vernazza et al. (2021), ESO-hosted author manuscript](https://www.eso.org/public/archives/releases/sciencepapers/eso2114/eso2114a.pdf) — retained primary publication; see the body-specific selection and calibration above.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1440 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

The 800-face Meshoptimizer preparation disables triangle regularization. Dense transfer probes found three points beyond the unchanged 1,440 m correspondence limit in the regularized candidate. The source-preserving option reduced the trial maximum over 51,200 interior probes to 989 m, with no withheld probes; this sampled check is not an exhaustive bound or an observation-accuracy claim.

</details>
