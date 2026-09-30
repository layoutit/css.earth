# TOI-5489

## Sources

Its radius and temperature follow Gomez Barrientos et al. 2026. The introduction is generated from Gomez Barrientos et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 602498085299079680, parallax 22.363 ± 0.018 mas (44.72 pc). Radius 0.42 +/- 0.01 solar radii from Gomez Barrientos et al. 2026, the stellar radius of the default parameter set of TOI-5489 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....171...99G/abstract). Mass 0.41 +/- 0.02 solar masses from Gomez Barrientos et al. 2026, the stellar mass of the default parameter set of TOI-5489 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....171...99G/abstract). Temperature 3,547 K from Gomez Barrientos et al. 2026, the stellar temperature of the default parameter set of TOI-5489 b in the NASA Exoplanet Archive. log g 4.8 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 602498085299079680, through the CIE 1931 2° observer: #ffc385. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,547 K and log g 4.8 (u1 0.395, u2 0.373): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
