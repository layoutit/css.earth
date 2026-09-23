# WD 1856+534

A cool white dwarf 24.76 parsecs away, about 1.3 times Earth's size, with a giant planet nearly eight times wider than itself. The default lens shows its measured Gaia colour on a uniform disc.

## Sources

[Limbach et al. (2025)](https://arxiv.org/abs/2504.16982), Table 1, supply the adopted radius (0.0121 ± 0.0002 solar radii), mass (0.605 solar masses) and temperature (4920 K). They replace the discovery values of [Vanderburg et al. (2020)](https://doi.org/10.1038/s41586-020-2713-y), Table 1 (0.0131 solar radii, 0.518 solar masses, 4710 K). SIMBAD's Gaia EDR3 astrometry places the star at an inverse-parallax distance of 24.757 pc.

The white dwarf has no radial velocity of its own: its spectrum has no lines. The record uses the mean of Gaia DR3's values for its two co-moving companions, G 229-20 A and B (17.29 km/s), and says so.

Gaia DR3 publishes only the continuous BP/RP coefficients for this star. They are sampled on the archive's 336–1020 nm grid with GaiaXPy 2.1.4 ([`xp-continuous-sample.py`](../../../tools/objects/observation/xp-continuous-sample.py)), the TRAPPIST-1 route. The shared stellar-colour preparer integrates the sampled spectrum against the CIE 1931 observer. Signal-to-noise is about 2 at 380 nm and 17 to 34 from 500 to 780 nm.

## Evidence

See the [system evidence](evidence/README.md).

## Known problems

- The disc has no limb darkening. The only law fitted to its transits ([Gendreau-Distler et al. 2026](https://doi.org/10.3847/1538-3881/ae8c30), Table 1, Bessel R: u1 = u2 = 0.52) puts the limb below zero brightness, and the shared preparer refuses it.
- The rotation axis is unmeasured; the display axis is celestial north.
- The wide M-dwarf companions G 229-20 A and B are not shown.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
