# K2-105

## Sources

Its radius and temperature follow Howard et al. 2025. The introduction is generated from Howard et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 651907079835937280, parallax 5.011 ± 0.015 mas (199.58 pc). Radius 0.905 +/- 0.035 solar radii from Howard et al. 2025, the stellar radius of the default parameter set of K2-105 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract). Mass 0.94 +/- 0.04 solar masses from Howard et al. 2025, the stellar mass of the default parameter set of K2-105 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract). Temperature 5,373 K from Howard et al. 2025, the stellar temperature of the default parameter set of K2-105 b in the NASA Exoplanet Archive. log g 4.5 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 651907079835937280, through the CIE 1931 2° observer: #ffe9dc. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,373 K and log g 4.5 (u1 0.554, u2 0.197): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
