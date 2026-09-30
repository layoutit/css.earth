# TOI-2010

## Sources

Its radius and temperature follow Mann et al. 2023. The introduction is generated from Mann et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2136815881249993600, parallax 9.222 ± 0.011 mas (108.44 pc). Radius 1.079 +/- 0.027 solar radii from Mann et al. 2023, the stellar radius of the default parameter set of TOI-2010 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166..239M/abstract). Mass 1.112 +/- 0.048 solar masses from Mann et al. 2023, the stellar mass of the default parameter set of TOI-2010 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166..239M/abstract). Temperature 5,929 K from Mann et al. 2023, the stellar temperature of the default parameter set of TOI-2010 b in the NASA Exoplanet Archive. log g 4.42 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2136815881249993600, through the CIE 1931 2° observer: #fff4f4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,929 K and log g 4.42 (u1 0.429, u2 0.278): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
