# (81) Terpsichore

Terpsichore is a main-belt asteroid about 118 km across. E. W. Tempel found Terpsichore at Marseille on 30 September 1864.

## Sources

Illustrative sphere at the 117.727 km diameter the JPL Small-Body Database lists for Terpsichore. No shape model is published. JPL Small-Body Database, physical parameters for 81 Terpsichore: diameter 117.727 ± 0.734 km; JPL's stated reference: urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M). The [pinned record](source/reference/sbdb.json) holds the values as JPL returned them on 2026-10-08.

- **Size:** 117.727 ± 0.734 km, from urn:nasa:pds:neowise_diameters_albedos::2.0[mainbelt] (http://adsabs.harvard.edu/abs/2014ApJ...791..121M).
- **Rotation:** 10.943 h, from LCDB (Rev. 2023-October); Warner et al., 2009. It is shown as a fact; the sphere's pole and phase are display conventions.
- **Orbit:** [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) osculating elements and vectors at the shared 2026-09-03 epoch.

- **Color:** [Gaia Collaboration, Galluccio et al. (2023)](https://doi.org/10.1051/0004-6361/202243791) published Terpsichore's reflectance against the Sun in 16 bands from 374 to 1034 nm, the mean of 18 Gaia epoch spectra. [The record](source/photometry/disc-color.json) turns the bands into one sRGB color, #3d3c3a, with the method of [shape-only material](../../../docs/shape-only-material.md).

- **Brightness:** the color is scaled to the visible geometric albedo the [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=81) lists, 4.5% ± 0.9%, from NEOWISE (Masiero et al. 2012, ApJ 759, L8; PDS bundle neowise_diameters_albedos 2.0).

## Evidence

Written on 2026-10-08 by `packages/bake/authoring/asteroid-spheres/author.mts` from its [inputs](../../../packages/bake/authoring/asteroid-spheres/inputs.json). No dated test report exists for this body yet.

## Known problems

The body is drawn as a sphere in one whole-disc color. Its true shape, pole and albedo pattern are not published, and none is shown. The pole and prime meridian are display conventions.

- The color is one mean for the whole disc, painted evenly: no terrain, albedo pattern or color variation is implied. Gaia DR3 reflectances are slightly too red at wavelengths shorter than 550 nm ([Tinaut-Ruano et al. 2023](https://doi.org/10.1051/0004-6361/202245134)); the bands are used as published.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

The [investigation ledger](investigations.json) records the source survey.
