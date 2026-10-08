# (1269) Rollandia

Rollandia is a outer main-belt asteroid about 105 km across. G. Neujmin found Rollandia at Simeis on 20 September 1930.

## Sources

Illustrative sphere at the 104.893 km diameter the JPL Small-Body Database lists for Rollandia. No shape model is published. JPL Small-Body Database, physical parameters for 1269 Rollandia: diameter 104.893 ± 1.042 km; JPL's stated reference: urn:nasa:pds:neowise_diameters_albedos::2.0[hildas] (http://adsabs.harvard.edu/abs/2012ApJ...744..197G). The [pinned record](source/reference/sbdb.json) holds the values as JPL returned them on 2026-10-08.

- **Size:** 104.893 ± 1.042 km, from urn:nasa:pds:neowise_diameters_albedos::2.0[hildas] (http://adsabs.harvard.edu/abs/2012ApJ...744..197G).
- **Rotation:** 60.45 h, from LCDB (Rev. 2023-October); Warner et al., 2009. It is shown as a fact; the sphere's pole and phase are display conventions.
- **Orbit:** [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) osculating elements and vectors at the shared 2026-09-03 epoch.

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Rollandia's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 17 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #403e3a, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=1269) lists, 4.8% ± 0.9%, from NEOWISE (Grav et al. 2012, ApJ 744, 197; PDS bundle neowise_diameters_albedos 2.0).

## Evidence

Written on 2026-10-08 by `packages/bake/authoring/asteroid-spheres/author.mts` from its [inputs](../../../packages/bake/authoring/asteroid-spheres/inputs.json). No dated test report exists for this body yet.

## Known problems

The body is drawn as a sphere in one whole-disc color. Its true shape, pole and albedo pattern are not published, and none is shown. The pole and prime meridian are display conventions.

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

The [investigation ledger](investigations.json) records the source survey.
