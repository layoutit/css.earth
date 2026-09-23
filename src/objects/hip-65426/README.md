# HIP 65426

HIP 65426 is a young, hot, fast-spinning star 108 parsecs away. Its giant planet b was found in 2017 and became JWST's first directly imaged exoplanet.

## Sources

**Placement.** Gaia DR3 source 6070080754075553792 (Gaia Collaboration 2023): position at J2016.0, proper motion and parallax ([source record](../../sources/gaia-dr3-hip-65426.json)).

**Radius, temperature and mass.** Chauvin et al. ([2017](https://arxiv.org/abs/1707.01413), A&A 605, L9), Table 1: 1.77 ± 0.05 solar radii from isochrones, 8,840 ± 200 K from the A2V spectral type, 1.96 ± 0.04 solar masses. Model values: the disc is not measured. The star spins fast (v sin i 299 km/s; Sepulveda et al. 2024 measure a rotation period of hours), which broadens its lines.

**Radial velocity.** Gaia DR3's 9.77 ± 0.71 km/s. Chauvin et al. measured −5.2 ± 1.3 km/s; the fast rotation makes both uncertain.

**Colour lens.** The colour of Gaia DR3's externally calibrated BP/RP sampled spectrum of the star, weighted by the CIE 1931 2° observer from 380 to 780 nm and converted to sRGB with the D65 white ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)). No limb darkening is drawn.

**Rotation.** No axis on the sky is measured; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version): see the planet's README for its placement against the measured positions. [The four stars in the app](evidence/imaged-companions-2.png), headless Chromium at 800 × 600 on this version: each is drawn in its Gaia spectrum's colour, with its planet's orbit crossing the view.

## Known problems

- The radius is a model or catalogue value; the disc is not measured.
- No limb darkening is drawn.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
