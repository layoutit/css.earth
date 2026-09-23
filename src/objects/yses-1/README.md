# YSES 1

YSES 1 is a 17-million-year-old analogue of the young Sun. Two giant planets orbit it far out; JWST has seen silicate clouds and a dusty disc around them.

## Sources

**Placement.** Gaia DR3 source 5864061893213196032 (Gaia Collaboration 2023): position at J2016.0, proper motion and parallax ([source record](../../sources/gaia-dr3-yses-1.json)).

**Radius, temperature and mass.** 4,573 ± 10 K, 1.00 ± 0.02 solar masses and 1.01 ± 0.02 solar radii as the ESO SupJup survey tabulates them (Zhang et al. [2024](https://arxiv.org/abs/2409.16660), Table 1) from Bohn et al. ([2020](https://arxiv.org/abs/2007.10991), ApJL 898, L16) and Gaia. Model values: the disc is not measured. Also catalogued as TYC 8998-760-1.

**Radial velocity.** 12.94 ± 0.03 km/s from VLT/CRIRES+ (Zhang et al. 2024, section 5.5); Gaia DR3 gives none.

**The second planet.** YSES 1 c, 6 Jupiter masses at about 320 au (Bohn et al. 2020), is not built: its astrometry does not yet constrain an orbit (Roberts et al. 2025, section 5), and a planet here is placed by its orbit ([ledger](investigations.json)).

**Colour lens.** The colour of Gaia DR3's externally calibrated BP/RP sampled spectrum of the star, weighted by the CIE 1931 2° observer from 380 to 780 nm and converted to sRGB with the D65 white ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)). No limb darkening is drawn.

**Rotation.** No axis on the sky is measured; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version): see the planet's README for its placement against the measured positions. [The four stars in the app](../hip-65426/evidence/imaged-companions-2.png), headless Chromium at 800 × 600 on this version: each is drawn in its Gaia spectrum's colour, with its planet's orbit crossing the view.

## Known problems

- The radius is a model or catalogue value; the disc is not measured.
- No limb darkening is drawn.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
