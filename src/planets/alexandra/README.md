# (54) Alexandra

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1817](https://damit.cuni.cz/projects/damit/asteroid_models/view/1817) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **1817**, version **2017-06-07**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2017); model 1817, version 2017-06-07.

Nonconvex model constrained by resolved imaging, 143 ± 5 km volume-equivalent diameter in the selected archive record. Grid marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [alexandra results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids/summary.json) record a maximum sampled source-to-display distance of **0.00 m**. This is a sampled comparison, not an exhaustive error bound.

The report includes 2 browser cases tied to recorded body assets. It does not identify the tested code revision.

## Known problems

The original mesh is uniformly scaled to the selected archive record’s declared volume-equivalent diameter. Published ensemble estimates can differ from this archived solution. Original coordinates and connectivity are retained; no albedo, craters or regolith are inferred.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; the grid marks that gap. Alternative archive solutions: model 136, pole ['156', '13'], [Model 136](https://damit.cuni.cz/projects/damit/asteroid_models/view/136)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 1535802.1750024606 source units³; an independent triangle-centroid divergence sum gives 1535802.1750024606. The existing recipe applies one uniform scale of 0.99898082481946016 km per source unit so its volume-equivalent diameter is 143 km.

No unit-volume assumption is made. Radius above a 71.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (154°, 17°), with sidereal period 7.02264 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

<details>
<summary>Source survey</summary>

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1817) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/284/shape.txt) — included unchanged. Resolved-imaging-constrained nonconvex geometry; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2017), Volumes and bulk densities of forty asteroids from ADAM shape modeling](https://ui.adsabs.harvard.edu/abs/2017A%26A...601A.114H) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the selected archive model has a physical size calibration. Its fitted nonrotating-sphere diameter is 144.46 ± 1.8 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. 2017](https://arxiv.org/abs/1702.01996), [Viikinkoski et al. 2017](https://arxiv.org/abs/1708.05191), and [Vernazza et al. 2021](https://damit.cuni.cz/projects/damit/references/view/660) — resolved-model releases surveyed; when present in this target’s archive they are preferred over an older convex model. Their disk images constrain geometry but are not registered global reflectance mosaics.
- [Hanuš et al. 2018](https://arxiv.org/abs/1803.06116) and [occultation dimensions](https://www.asteroidoccultation.com/observations/Asteroid_Dimensions_from_Occultations.html) — size comparison candidates; an independent fit or occultation ellipsoid is not silently equated with this mesh’s volume.

</details>

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path starts from the source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1430 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
