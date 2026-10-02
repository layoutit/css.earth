# TOI-1235

## Sources

Its radius and temperature follow Bluhm et al. 2020. The introduction is generated from Bluhm et al. 2020's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1070387905514406400, parallax 25.243 ± 0.013 mas (39.61 pc). Radius 0.619 +/- 0.019 solar radii from Bluhm et al. 2020, the stellar radius of the default parameter set of TOI-1235 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...639A.132B/abstract). Mass 0.63 +/- 0.024 solar masses from Bluhm et al. 2020, the stellar mass of the default parameter set of TOI-1235 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...639A.132B/abstract). Temperature 3,997 K from Bluhm et al. 2020, the stellar temperature of the default parameter set of TOI-1235 b in the NASA Exoplanet Archive. log g 4.65 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1070387905514406400, through the CIE 1931 2° observer: #ffc091. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,997 K and log g 4.65 (u1 0.551, u2 0.212): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
