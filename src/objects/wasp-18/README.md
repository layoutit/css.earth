# WASP-18

## Sources

WASP-18 (HD 10069) is an F6 star in Phoenix, 123 parsecs away. Its planet [WASP-18b](../wasp-18b/README.md), ten times Jupiter's mass, circles it in 22.6 hours.

- **Placement:** Gaia DR3 source 4955371367334610048 (`source/photometry/gaia-dr3-source.csv`): position at J2016.0, parallax 8.1443 ± 0.0116 mas (122.8 pc, no zero-point correction), proper motion and radial velocity.
- **Radius and mass:** 1.347 solar radii ("From TESS data") and 1.5596 solar masses, the values in the ThERESA configuration Challener, Weiner Mansfield et al. (2025) deposited with the planet's map ([Zenodo 10.5281/zenodo.14751570](https://zenodo.org/records/14751570)). With its semi-major axis, 0.02180079 au, the radius gives the a/R* of 3.48023 the maps were fitted with. Cortés-Zuleta et al. (2020, A&A 636, A98, Table 3) give 1.319 +0.061/−0.062 solar radii and 1.294 solar masses.
- **Colour:** the Gaia DR3 BP/RP sampled spectrum through the CIE 1931 2° observer: sRGB (243, 240, 255).
- **Limb:** the quadratic law Claret (2017, A&A 600, A30) computes from PHOENIX models for the TESS band, read at Cortés-Zuleta et al.'s 6,432 K and log g 4.310: u1 0.318, u2 0.225. The table gives solar metallicity only; the star is at [Fe/H] +0.11. A model, stated as one.
- **Rotation:** unmeasured here. The display axis is celestial north in the plane of the sky (`source/preparation/rotation.json`).

Catalogue colour: #f3f0ff, this lens's prepared colour.

## Evidence

Run of 2026-09-23 (this version):

- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks the catalogue distance against the world frame and that the catalogue colour is the colour lens's prepared colour.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) places WASP-18 and WASP-18b in one system.

## Known problems

- **The star is unresolved.** It is 0.1 mas across; the limb is a model and no image exists ([ledger](investigations.json)).
- **The radius is the mapping configuration's, not a table value.** It is kept so the planet's orbit matches the fit its maps come from; Cortés-Zuleta et al. (2020) measure 1.319 solar radii.
- **The spin axis is a display convention.**

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
