# TOI-2096

## Sources

Its radius and temperature follow Pozuelos et al. 2023. The introduction is generated from Pozuelos et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1126422935076082176, parallax 20.635 ± 0.019 mas (48.46 pc). Radius 0.235 +/- 0.011 solar radii from Pozuelos et al. 2023, the stellar radius of the default parameter set of TOI-2096 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...672A..70P/abstract). Mass 0.231 +/- 0.012 solar masses from Pozuelos et al. 2023, the stellar mass of the default parameter set of TOI-2096 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...672A..70P/abstract). Temperature 3,300 K from Pozuelos et al. 2023, the stellar temperature of the default parameter set of TOI-2096 b in the NASA Exoplanet Archive. log g 5.06 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1126422935076082176, through the CIE 1931 2° observer: #ffc77d. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,300 K and log g 5.06 (u1 0.153, u2 0.462): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
