# WASP-76

## Sources

WASP-76 is a metal-rich F7 star, 1.46 solar masses, 189 parsecs away. Its giant planet [WASP-76b](../wasp-76b/README.md) is where ESPRESSO saw iron condense on the night side (Ehrenreich et al. 2020, [Nature 580, 597](https://doi.org/10.1038/s41586-020-2107-1); [arXiv:2003.05528](https://arxiv.org/abs/2003.05528)). A fainter K-type companion, WASP-76 B, lies 0.44″ away; it has no published orbit and is not placed.

- **Placement:** Gaia DR3 source 2512326349403275520 (`source/photometry/gaia-dr3-source.csv`): position at J2016.0, parallax 5.2899 ± 0.0826 mas (189.0 pc, no zero-point correction), proper motion and radial velocity.
- **Radius and mass:** 1.756 ± 0.071 solar radii and 1.458 ± 0.021 solar masses, from Ehrenreich et al.'s ESPRESSO spectra and the Gaia DR2 parallax (Extended Data Table 1).
- **Color:** the Gaia DR3 BP/RP sampled spectrum through the CIE 1931 2° observer: sRGB (248, 243, 255). The companion is inside Gaia's BP/RP window, so its redder light is in the spectrum.
- **Limb:** the model law in the Limb paragraph below, read at solar metallicity; the star is at [Fe/H] +0.37.
- **Rotation:** only the angle between the spin axis and the orbit on the sky is measured, 61.28°. The display axis is celestial north in the plane of the sky (`source/preparation/rotation.json`).

Catalogue color: #f8f3ff, this dataset's prepared color.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,329 K and log g 4.11 (u1 0.368, u2 0.308): a model, because no fit of this star's limb is used. Gravity: log g from the mass and radius in packages/astronomy/data/bodies/wasp-76.json: 4.113.

## Evidence

Run of 2026-09-23 (this version):

- [`object-package-consistency.test.mts`](../../../src/objects/object-package-consistency.test.mts) checks the catalogue distance against the world frame and that the catalogue color is the color dataset's prepared color.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) places WASP-76 and WASP-76b in one system.

## Known problems

- **The color includes the companion.** WASP-76 B is about ten times fainter in the optical and redder. It sits 0.44″ away, inside Gaia's BP/RP window, so the color is a little redder than the primary's alone.
- **The star is unresolved.** It is 0.09 mas across; the limb is a model and no image exists ([ledger](investigations.json)).
- **The spin axis is a display convention.** Its tilt toward the line of sight is not measured.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
