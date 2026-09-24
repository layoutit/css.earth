# HD 206893

HD 206893 is a young star 41 parsecs away. VLTI/GRAVITY found its inner planet c in 2022, and now tracks its brown dwarf B closely enough to search it for a moon.

## Sources

**Placement.** Gaia DR3 source 6843672087120107264 (Gaia Collaboration 2023): position at J2016.0, proper motion and parallax ([source record](../../sources/gaia-dr3-hd-206893.json)).

**Radius, temperature and mass.** 6,554 K from the BT-NextGen fit to the star's spectral energy distribution by Kral et al. ([2026](https://arxiv.org/abs/2511.20091), A&A 705, A217), and 1.31 solar masses from their joint orbit fit of B and c (Table 2). No paper used here gives a radius, so it is Gaia DR3's FLAME value, 1.37 solar radii: a model value from Gaia's photometry and parallax, not a measured disc.

**Radial velocity.** Gaia DR3's -11.80 ± 0.14 km/s.

**Colour lens.** The colour of Gaia DR3's externally calibrated BP/RP sampled spectrum of the star, weighted by the CIE 1931 2° observer from 380 to 780 nm and converted to sRGB with the D65 white ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)). Its limb is darkened by the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 6,554 K (the record) and log g 4.28 (from the record's mass and radius (packages/astronomy/data/bodies/hd-206893.json)): a model, since no fit of this star's limb exists.

**Rotation.** No axis on the sky is measured; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version): see the planet's README for its placement against the measured positions. [The four stars in the app](evidence/imaged-companions-3.png), headless Chromium at 800 × 600 on this version: each is drawn in its measured colour.

## Known problems

- The radius is a model or catalogue value; the disc is not measured.
- The limb darkening is a model: the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 6,554 K (the record) and log g 4.28 (from the record's mass and radius (packages/astronomy/data/bodies/hd-206893.json)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
