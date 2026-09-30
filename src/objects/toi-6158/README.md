# TOI-6158

## Sources

Its radius and temperature follow O'Brien et al. 2026. The introduction is generated from O'Brien et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1775027485705816960, parallax 5.495 ± 0.065 mas (182.00 pc). Radius 0.476 +/- 0.013 solar radii from O'Brien et al. 2026, the stellar radius of the default parameter set of TOI-6158 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172..117O/abstract). Mass 0.503 +/- 0.022 solar masses from O'Brien et al. 2026, the stellar mass of the default parameter set of TOI-6158 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172..117O/abstract). Temperature 3,467 K from O'Brien et al. 2026, the stellar temperature of the default parameter set of TOI-6158 b in the NASA Exoplanet Archive. log g 4.78 from the mass and radius.

**Colour.** A Planck spectrum at 3,467 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffc689. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,467 K and log g 4.78 (u1 0.173, u2 0.431): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
