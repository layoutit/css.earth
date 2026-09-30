# TOI-5799

## Sources

Its radius and temperature follow Yalçinkaya et al. 2025. The introduction is generated from Yalçinkaya et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1807887150930343424, parallax 35.896 ± 0.017 mas (27.86 pc). Radius 0.321 +/- 0.014 solar radii from Yalçinkaya et al. 2025, the stellar radius of the default parameter set of TOI-5799 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...702A.209Y/abstract). Mass 0.325 +/- 0.03 solar masses from Yalçinkaya et al. 2025, the stellar mass of the default parameter set of TOI-5799 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...702A.209Y/abstract). Temperature 3,452 K from Yalçinkaya et al. 2025, the stellar temperature of the default parameter set of TOI-5799 b in the NASA Exoplanet Archive. log g 4.94 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1807887150930343424, through the CIE 1931 2° observer: #ffc280. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,452 K and log g 4.94 (u1 0.162, u2 0.437): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
