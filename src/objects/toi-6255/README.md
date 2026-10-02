# TOI-6255

## Sources

Its radius and temperature follow Dai et al. 2024. The introduction is generated from Dai et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1956328333130770048, parallax 49.054 ± 0.024 mas (20.39 pc). Radius 0.37 +/- 0.011 solar radii from Dai et al. 2024, the stellar radius of the default parameter set of TOI-6255 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....168..101D/abstract). Mass 0.353 +/- 0.015 solar masses from Dai et al. 2024, the stellar mass of the default parameter set of TOI-6255 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....168..101D/abstract). Temperature 3,421 K from Dai et al. 2024, the stellar temperature of the default parameter set of TOI-6255 b in the NASA Exoplanet Archive. log g 4.85 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1956328333130770048, through the CIE 1931 2° observer: #ffc885. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,421 K and log g 4.85 (u1 0.165, u2 0.440): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
