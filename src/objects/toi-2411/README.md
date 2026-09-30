# TOI-2411

## Sources

Its radius and temperature follow Giacalone et al. 2022. The introduction is generated from Giacalone et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2471334872292963456, parallax 16.811 ± 0.031 mas (59.48 pc). Radius 0.68 +/- 0.02 solar radii from Giacalone et al. 2022, the stellar radius of the default parameter set of TOI-2411 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...99G/abstract). Mass 0.65 +/- 0.02 solar masses from Giacalone et al. 2022, the stellar mass of the default parameter set of TOI-2411 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...99G/abstract). Temperature 4,099 K from Giacalone et al. 2022, the stellar temperature of the default parameter set of TOI-2411 b in the NASA Exoplanet Archive. log g 4.59 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2471334872292963456, through the CIE 1931 2° observer: #ffc197. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,099 K and log g 4.59 (u1 0.645, u2 0.131): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
