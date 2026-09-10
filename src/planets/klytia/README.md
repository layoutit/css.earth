# (73) Klytia

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 142](https://damit.cuni.cz/projects/damit/asteroid_models/view/142) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **142**, version **2011-04-20**. DAMIT, Astronomical Institute of Charles University; A. Marciniak (2008), Hanuš (2011); model 142, version 2011-04-20.

Convex light-curve shape with thermophysical volume-equivalent diameter 45.4 ± 1.3 km. The published fit uses the same pole family; an alternative pole remains possible. The grid marks unavailable imagery and rotational phase is illustrative.

## Evidence

The [klytia results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids/summary.json) record a maximum sampled source-to-display distance of **135.35 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

Only a uniform scale from the published thermophysical fit is transferred to the archived nominal mesh. The varied-model ensemble does not establish identical mesh bytes or local surface accuracy. The alternative pole remains possible. No thermal or reflectance map is inferred.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 143, pole ['266', '68'], [Model 143](https://damit.cuni.cz/projects/damit/asteroid_models/view/143)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

Hanuš et al. (2018), Table A.3 reports pole (44°, 83°), consistent with the selected archive pole, and period 8.28307 h. The nominal mesh remains unchanged at 1008 vertices and 2012 triangles, volume 1.0000000444553148 source units³. Uniform scale is 36.592216813934364 km per source unit; radius minus a 22.7 km sphere is the Elevation datum.

No unit-volume assumption or independent topography claim is made. The original body axes are retained, pole conversion uses obliquity 23.439291111°, and absolute rotational phase remains arbitrary. Position uses the retained JPL ICRF scene epoch.

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/142) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/299/shape.txt) — included unchanged. Convex light-curve inversion; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [A. Marciniak (2008), Photometry and models of selected main belt asteroids. V. 73 Klytia, 377 Campania, and 378 Holmia](https://ui.adsabs.harvard.edu/abs/2008A%26A...478..559M) — original model publication record.
- [Hanuš (2011), A study of asteroid pole-latitude distribution based on an extended set of shape models derived by the lightcurve inversion method](https://ui.adsabs.harvard.edu/abs/2011A%26A...530A.134H) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — excluded from physical scaling because the shape-aware VS-TPM fit is available. Its fitted nonrotating-sphere diameter is 45.51 ± 0.52 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. 2017](https://arxiv.org/abs/1702.01996), [Viikinkoski et al. 2017](https://arxiv.org/abs/1708.05191), and [Vernazza et al. 2021](https://damit.cuni.cz/projects/damit/references/view/660) — resolved-model releases surveyed; when present in this target’s archive they are preferred over an older convex model. Their disk images constrain geometry but are not registered global reflectance mosaics.
- [Hanuš et al. 2018](https://arxiv.org/abs/1803.06116) and [occultation dimensions](https://www.asteroidoccultation.com/observations/Asteroid_Dimensions_from_Occultations.html) — VS-TPM selected for this pole family; occultation ellipsoids are not silently substituted for mesh volume.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 454 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
