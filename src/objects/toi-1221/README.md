# TOI-1221

## Sources

Its radius and temperature follow Mann et al. 2023. The introduction is generated from Mann et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5282270085669557504, parallax 7.296 ± 0.011 mas (137.06 pc). Radius 1.031 +/- 0.022 solar radii from Mann et al. 2023, the stellar radius of the default parameter set of TOI-1221 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..217M/abstract). Mass 0.93 +/- 0.22 solar masses from Mann et al. 2023, the stellar mass of the default parameter set of TOI-1221 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..217M/abstract). Temperature 5,592 K from Mann et al. 2023, the stellar temperature of the default parameter set of TOI-1221 b in the NASA Exoplanet Archive. log g 4.38 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5282270085669557504, through the CIE 1931 2° observer: #ffeee7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,592 K and log g 4.38 (u1 0.499, u2 0.234): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
