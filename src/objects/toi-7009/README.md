# TOI-7009

## Sources

Its radius and temperature follow Morello et al. 2026. The introduction is generated from Morello et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2233920659406441856, parallax 5.418 ± 0.011 mas (184.58 pc). Radius 0.564 +/- 0.016 solar radii from Morello et al. 2026, the stellar radius of the default parameter set of TOI-7009 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.549ag183M/abstract). Mass 0.583 +/- 0.014 solar masses from Morello et al. 2026, the stellar mass of the default parameter set of TOI-7009 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.549ag183M/abstract). Temperature 4,080 K from Morello et al. 2026, the stellar temperature of the default parameter set of TOI-7009 b in the NASA Exoplanet Archive. log g 4.7 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2233920659406441856, through the CIE 1931 2° observer: #ffc59f. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,080 K and log g 4.7 (u1 0.589, u2 0.178): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
