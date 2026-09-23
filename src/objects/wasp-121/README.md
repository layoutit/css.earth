# WASP-121

## Sources

WASP-121 (TOI-495, IAU name Dilmun) is an F6 star in Puppis, 263 parsecs away. Its planet [WASP-121b](../wasp-121b/README.md) circles it in 30.6 hours on an orbit that passes nearly over its poles.

- **Placement:** Gaia DR3 source 5565050255701441664 (`source/photometry/gaia-dr3-source.csv`): position at J2016.0, parallax 3.7996 ± 0.0104 mas (263.2 pc, no zero-point correction), proper motion and radial velocity.
- **Radius and mass:** 10^0.1567 = 1.4345 solar radii and 1.332 solar masses, the white phase-curve fit of Evans-Soma et al. (2025, Nature Astronomy 9, 845, Supplementary Table 1) whose planet maps this system shows. The star's size and mass set the orbit starry fitted the maps in. Their isochrone analysis (Supplementary Table 9) gives 1.49 solar radii and 1.36 solar masses.
- **Colour:** the Gaia DR3 BP/RP sampled spectrum through the CIE 1931 2° observer: sRGB (241, 239, 255).
- **Limb:** the quadratic law Claret (2017, A&A 600, A30) computes from PHOENIX models for the TESS band, read at Evans-Soma et al.'s 6,481 K and log g 4.23: u1 0.319, u2 0.223. The table gives solar metallicity only; the star is at [Fe/H] +0.11. A model, stated as one.
- **Rotation:** Bourrier et al. (2020, A&A 635, A205) measure the star's inclination (8.1 +3.0/−2.6°, if its north pole is the visible one) and the planet's nearly polar 3D obliquity (88.1 ± 0.25°). The orbit's position angle on the sky is unmeasured, so the axis has no sky direction here; the display axis is celestial north in the plane of the sky (`source/preparation/rotation.json`).

Catalogue colour: #f1efff, this lens's prepared colour.

## Evidence

Run of 2026-09-23 (this version):

- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks the catalogue distance against the world frame and that the catalogue colour is the colour lens's prepared colour.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) places WASP-121 and WASP-121b in one system.

## Known problems

- **The star is unresolved.** It is 0.05 mas across; the limb is a model and no image exists ([ledger](investigations.json)).
- **The radius is the phase-curve fit's.** It is kept so the planet's orbit matches the fit its maps come from; the isochrone radius is 4 % larger.
- **The spin axis is a display convention.** Its tilt to the line of sight is measured; its direction on the sky is not.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
