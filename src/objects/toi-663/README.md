# TOI-663

## Sources

Its radius and temperature follow Cointepas et al. 2024. The introduction is generated from Cointepas et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3762515188088861184, parallax 15.639 ± 0.023 mas (63.94 pc); its RUWE is 1.6, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.512 +/- 0.015 solar radii from Cointepas et al. 2024, the stellar radius of the default parameter set of TOI-663 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...685A..19C/abstract). Mass 0.514 +/- 0.012 solar masses from Cointepas et al. 2024, the stellar mass of the default parameter set of TOI-663 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...685A..19C/abstract). Temperature 3,681 K from Cointepas et al. 2024, the stellar temperature of the default parameter set of TOI-663 b in the NASA Exoplanet Archive. log g 4.73 from the mass and radius.

**Color.** A Planck spectrum at 3,681 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffcc95. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,681 K and log g 4.73 (u1 0.399, u2 0.359): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
