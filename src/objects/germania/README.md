# (241) Germania

Germania is a main-belt asteroid about 169 km across. R. Luther found Germania at Dusseldorf on 12 September 1884.

## Sources

Illustrative sphere at the 168.9 km diameter the JPL Small-Body Database lists for Germania. No shape model is published. JPL Small-Body Database, physical parameters for 241 Germania: diameter 168.9 ± 3.1 km; JPL's stated reference: IRAS-A-FPA-3-RDR-IMPS-V6.0. The [pinned record](source/reference/sbdb.json) holds the values as JPL returned them on 2026-10-08.

- **Size:** 168.9 ± 3.1 km, from IRAS-A-FPA-3-RDR-IMPS-V6.0.
- **Rotation:** 15.51 h, from LCDB (Rev. 2023-October); Warner et al., 2009. It is shown as a fact; the sphere's pole and phase are display conventions.
- **Orbit:** [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) osculating elements and vectors at the shared 2026-09-03 epoch.

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Germania's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 24 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #444442, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=241) lists, 5.8% ± 0.2%, from the IRAS Minor Planet Survey (PDS data set IRAS-A-FPA-3-RDR-IMPS-V6.0).

## Evidence

Written on 2026-10-08 by `packages/bake/authoring/asteroid-spheres/author.mts` from its [inputs](../../../packages/bake/authoring/asteroid-spheres/inputs.json). No dated test report exists for this body yet.

## Known problems

The body is drawn as a sphere in one whole-disc color. Its true shape, pole and albedo pattern are not published, and none is shown. The pole and prime meridian are display conventions.

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

The [investigation ledger](investigations.json) records the source survey.
