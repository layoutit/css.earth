# TOI-444

## Sources

Its radius and temperature follow Oddo et al. 2023. It is also HD 27196, HIP 19950. The introduction is generated from Oddo et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4895489043507741440, parallax 17.405 ± 0.014 mas (57.45 pc). Radius 0.779 +/- 0.053 solar radii from Oddo et al. 2023, the stellar radius of the default parameter set of TOI-444 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..134O/abstract). Mass 0.96 +/- 0.13 solar masses from Oddo et al. 2023, the stellar mass of the default parameter set of TOI-444 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..134O/abstract). Temperature 5,225 K from Oddo et al. 2023, the stellar temperature of the default parameter set of TOI-444 b in the NASA Exoplanet Archive. log g 4.64 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4895489043507741440, through the CIE 1931 2° observer: #ffe4d3. Routes tried in order: stis-ngsl: HD 27196 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,225 K and log g 4.64 (u1 0.594, u2 0.168): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
