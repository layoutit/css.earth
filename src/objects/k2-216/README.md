# K2-216

## Sources

Its radius and temperature follow Persson et al. 2018. The introduction is generated from Persson et al. 2018's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2556231154370582400, parallax 8.688 ± 0.023 mas (115.10 pc); its RUWE is 1.6, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.72 +/- 0.03 solar radii from Persson et al. 2018, the stellar radius of the default parameter set of K2-216 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018A&A...618A..33P/abstract). Mass 0.7 +/- 0.03 solar masses from Persson et al. 2018, the stellar mass of the default parameter set of K2-216 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018A&A...618A..33P/abstract). Temperature 4,503 K from Persson et al. 2018, the stellar temperature of the default parameter set of K2-216 b in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2556231154370582400, through the CIE 1931 2° observer: #ffceaf. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,503 K and log g 4.57 (u1 0.780, u2 0.016): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
