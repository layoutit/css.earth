# WASP-18

## Sources

WASP-18 (HD 10069) is an F6 star in Phoenix, 123 parsecs away. Its planet [WASP-18b](../wasp-18b/README.md), ten times Jupiter's mass, circles it in 22.6 hours.

- **Placement:** Gaia DR3 source 4955371367334610048 (`source/photometry/gaia-dr3-source.csv`): position at J2016.0, parallax 8.1443 ± 0.0116 mas (122.8 pc, no zero-point correction), proper motion and radial velocity.
- **Radius and mass:** 1.347 solar radii ("From TESS data") and 1.5596 solar masses, the values in the ThERESA configuration Challener, Weiner Mansfield et al. (2025) deposited with the planet's map ([Zenodo 10.5281/zenodo.14751570](https://zenodo.org/records/14751570)). With its semi-major axis, 0.02180079 au, the radius gives the a/R* of 3.48023 the maps were fitted with. Cortés-Zuleta et al. (2020, A&A 636, A98, Table 3) give 1.319 +0.061/−0.062 solar radii and 1.294 solar masses.
- **Color:** the Gaia DR3 BP/RP sampled spectrum through the CIE 1931 2° observer: sRGB (243, 240, 255).
- **Limb:** the model law in the Limb paragraph below, read at solar metallicity; the star is at [Fe/H] +0.11.
- **Rotation:** unmeasured here. The display axis is celestial north in the plane of the sky (`source/preparation/rotation.json`).

Catalogue color: #f3f0ff, this dataset's prepared color.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,432 K and log g 4.37 (u1 0.357, u2 0.312): a model, because no fit of this star's limb is used. Gravity: log g from the mass and radius in packages/astronomy/data/bodies/wasp-18.json: 4.372.

## Evidence

Run of 2026-09-23 (this version):

- [`object-package-consistency.test.mts`](../../../src/objects/object-package-consistency.test.mts) checks the catalogue distance against the world frame and that the catalogue color is the color dataset's prepared color.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) places WASP-18 and WASP-18b in one system.

## Known problems

- **The star is unresolved.** It is 0.1 mas across; the limb is a model and no image exists ([ledger](investigations.json)).
- **The radius is the mapping configuration's, not a table value.** It is kept so the planet's orbit matches the fit its maps come from; Cortés-Zuleta et al. (2020) measure 1.319 solar radii.
- **The spin axis is a display convention.**
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
