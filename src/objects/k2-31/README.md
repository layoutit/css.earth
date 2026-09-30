# K2-31

## Sources

Its radius and temperature follow Grziwa et al. 2016. The introduction is generated from Grziwa et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6050191241556876672, parallax 9.076 ± 0.017 mas (110.18 pc). Radius 0.78 +/- 0.07 solar radii from Grziwa et al. 2016, the stellar radius of the default parameter set of K2-31 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016AJ....152..132G/abstract). Mass 0.91 +/- 0.06 solar masses from Grziwa et al. 2016, the stellar mass of the default parameter set of K2-31 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016AJ....152..132G/abstract). Temperature 5,280 K from Grziwa et al. 2016, the stellar temperature of the default parameter set of K2-31 b in the NASA Exoplanet Archive. log g 4.61 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 6050191241556876672, through the CIE 1931 2° observer: #ffe9da. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,280 K and log g 4.61 (u1 0.579, u2 0.179): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
