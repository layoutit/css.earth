# WASP-76

## Sources

WASP-76 is a metal-rich F7 star, 1.46 solar masses, 189 parsecs away. Its giant planet [WASP-76b](../wasp-76b/README.md) is where ESPRESSO saw iron condense on the night side (Ehrenreich et al. 2020, [Nature 580, 597](https://doi.org/10.1038/s41586-020-2107-1); [arXiv:2003.05528](https://arxiv.org/abs/2003.05528)). A fainter K-type companion, WASP-76 B, lies 0.44″ away; it has no published orbit and is not placed.

- **Placement:** Gaia DR3 source 2512326349403275520 (`source/photometry/gaia-dr3-source.csv`): position at J2016.0, parallax 5.2899 ± 0.0826 mas (189.0 pc, no zero-point correction), proper motion and radial velocity.
- **Radius and mass:** 1.756 ± 0.071 solar radii and 1.458 ± 0.021 solar masses, from Ehrenreich et al.'s ESPRESSO spectra and the Gaia DR2 parallax (Extended Data Table 1).
- **Colour:** the Gaia DR3 BP/RP sampled spectrum through the CIE 1931 2° observer: sRGB (248, 243, 255). The companion is inside Gaia's BP/RP window, so its redder light is in the spectrum.
- **Limb:** the quadratic law Claret (2017, A&A 600, A30) computes from PHOENIX models for the TESS band, read at the paper's 6,329 K and log g 4.196: u1 0.329, u2 0.222. The table gives only solar metallicity for those models; the star is at [Fe/H] +0.37. A model, stated as one.
- **Rotation:** only the angle between the spin axis and the orbit on the sky is measured, 61.28°. The display axis is celestial north in the plane of the sky (`source/preparation/rotation.json`).

Catalogue colour: #f8f3ff, this lens's prepared colour.

## Evidence

Run of 2026-09-23 (this version):

- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks the catalogue distance against the world frame and that the catalogue colour is the colour lens's prepared colour.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) places WASP-76 and WASP-76b in one system.

## Known problems

- **The colour includes the companion.** WASP-76 B is about ten times fainter in the optical and redder. It sits 0.44″ away, inside Gaia's BP/RP window, so the colour is a little redder than the primary's alone.
- **The star is unresolved.** It is 0.09 mas across; the limb is a model and no image exists ([ledger](investigations.json)).
- **The spin axis is a display convention.** Its tilt toward the line of sight is not measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
