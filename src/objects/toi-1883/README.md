# TOI-1883

## Sources

Its radius and temperature follow Fukuda et al. 2026. The introduction is generated from Fukuda et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5735744144510573696, parallax 8.508 ± 0.024 mas (117.53 pc). Radius 0.506 +/- 0.015 solar radii from Fukuda et al. 2026, the stellar radius of the default parameter set of TOI-1883 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026PASJ...78.1602F/abstract). Mass 0.495 +/- 0.011 solar masses from Fukuda et al. 2026, the stellar mass of the default parameter set of TOI-1883 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026PASJ...78.1602F/abstract). Temperature 3,554 K from Fukuda et al. 2026, the stellar temperature of the default parameter set of TOI-1883 b in the NASA Exoplanet Archive. log g 4.72 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5735744144510573696, through the CIE 1931 2° observer: #ffca8d. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,554 K and log g 4.72 (u1 0.407, u2 0.364): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
