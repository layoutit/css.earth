# Wolf 503

## Sources

Its radius and temperature follow Polanski et al. 2021. It is also HIP 67285. The introduction is generated from Polanski et al. 2021's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3620325206217720320, parallax 22.406 ± 0.017 mas (44.63 pc). Radius 0.689 +/- 0.021 solar radii from Polanski et al. 2021, the stellar radius of the default parameter set of Wolf 503 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..238P/abstract). Mass 0.688 +/- 0.023 solar masses from Polanski et al. 2021, the stellar mass of the default parameter set of Wolf 503 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..238P/abstract). Temperature 4,716 K from Polanski et al. 2021, the stellar temperature of the default parameter set of Wolf 503 b in the NASA Exoplanet Archive. log g 4.6 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3620325206217720320, through the CIE 1931 2° observer: #ffd3bc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,716 K and log g 4.6 (u1 0.733, u2 0.056): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
