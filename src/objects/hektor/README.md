# Hektor

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="selected-model"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 232](https://damit.cuni.cz/projects/damit/asteroid_models/view/232) |

[Original DAMIT model 232](https://damit.cuni.cz/projects/damit/asteroid_models/view/232), version 2016-06-27, is a calibrated convex reconstruction. The model page explicitly marks calibrated size = yes; DAMIT documentation defines these coordinates in kilometers. The original model page, metadata, referenced bibliographic records, frame documentation and available IAUspin file are checked in and pinned.

The saved HTML is evidence only; its viewer scripts are never evaluated or included at runtime.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

The [asteroid validation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-validation.md) records the earlier source, preparation and browser checks. Some raw captures cited there have local `output/` paths.

Independent 8192 area-stratified samples in each direction measured nearest-triangle distances: p95 170.994 m, maximum 585.459 m. These are sampled distances, not exhaustive error bounds. All source face centroids and 8192 sphere directions were checked for radial ambiguity; no second radial intersection was found.

Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they are geometry inspection, not browser pixel parity.

## Known problems

<a id="source-survey-and-model-limits"></a>

Shape uses the shared missing-imagery grid. DAMIT's viewer illustrations are not source surface maps; no albedo, photographic color, regolith or composition is inferred. Elevation shows the radius of the original model minus a 87.5 km sphere, on a -30 to 60 km legend.

This is a second display of the same reconstruction, not an independent measurement or height above a gravitational equipotential. A 4096 × 2048 display map does not add observational detail. The existing scientific recipe samples 721 × 361 directions, then applies its documented cartographic relief.

Prime-meridian display phase is explicitly arbitrary; the available IAUspin file is preserved but no absolute rotational ephemeris is claimed.

DAMIT 232 convex reconstruction, original 175 km catalog scale; primary only.

- [AO-constrained bilobed and close-binary alternatives, roughly 250 km scale.](https://arxiv.org/abs/1402.7336) — unresolved for mesh replacement. The paper shows multiple shape solutions. A released original bilobed mesh with its calibration was not located in the checked sources. This package explicitly displays the released convex reconstruction and does not claim the later bilobed morphology or size.

Disk-integrated light curves, thermal spectra and DAMIT preview renders supply no registered global surface imagery. Shape therefore uses the shared grid; Elevation restates only the chosen model.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Selected model</summary>

[Original counted triangle table](https://damit.cuni.cz/projects/damit/stored_files/open/751/shape.txt) has 1022 vertices and 2040 triangles. It is consumed without conversion by the existing PDS plate-table reader because its count/XYZ/one-based-triangle layout is identical. This is a DAMIT dataset, not a PDS release.

Its vertices, outward winding and co-rotating frame remain unchanged. Positive Z is the spin pole and positive X defines the meridian.

The record gives diameter 175 km, period 6.920509 h and ecliptic J2000 pole (333°, -31°). The original mesh has measured volume-equivalent radius 87.500004 km and Cartesian extents 252.408 × 213.322 × 126.786 km. The rounded catalog diameter is used as the reference-sphere scale; the original coordinates are not rescaled.

- [Kaasalainen et al. (2002), Binary structures among large asteroids](https://ui.adsabs.harvard.edu/abs/2002A%26A...383L..19K) — selected model publication.

- [Hanuš et al. (2015), Thermophysical modeling of asteroids from WISE thermal infrared data - Significance of the shape model and the pole orientation uncertainties](https://ui.adsabs.harvard.edu/abs/2015Icar..256..101H) — selected model publication.

</details>

<a id="appearance-and-preparation"></a>

<details>
<summary>Appearance and preparation</summary>

The existing source-meshoptimizer recipe reduces the original connected surface to 800 triangles. Meshoptimizer 1.2.0 reports 638.1 m estimated error, below the authored 700 m stopping threshold; this estimate is not a Hausdorff bound. All models use 800 native PolyCSS u raster leaves, 128 × 128 px per leaf in a 2048 × 6400 atlas, with lighting and texels prepared ahead of runtime.

The surface remains one closed component with Euler characteristic 2.

</details>

<a id="frame-source-closure-and-delivery"></a>

<details>
<summary>Frame, source closure and delivery</summary>

The source ecliptic J2000 pole is converted with obliquity 23.439291111° for the existing observed-pole recipe.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The conic is a fixed-epoch display approximation, not a long-term perturbation ephemeris. TDB is approximated as TT within 2 ms.

GM is the value in the pinned Horizons physical block, or zero for an unavailable GM; it is not inferred from an assumed density.

[source/manifest.json](source/manifest.json) pins every consumed file. The original mesh is checked in and also restorable through source/preparation/acquisition.json, along with the Inter font. Original model-record snapshots and supporting documents remain checked in because server-generated HTML contains changing timestamps.

The pinned context PNG is reproduced by the existing radial snapshot recipe.

</details>
