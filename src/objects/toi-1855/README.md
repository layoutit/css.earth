# TOI-1855

## Sources

Its radius and temperature follow Schulte et al. 2024. The introduction is generated from Schulte et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1247603719345703808, parallax 5.666 ± 0.017 mas (176.50 pc). Radius 1.041 +/- 0.031 solar radii from Schulte et al. 2024, the stellar radius of the default parameter set of TOI-1855 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....168...32S/abstract). Mass 0.987 +/- 0.058 solar masses from Schulte et al. 2024, the stellar mass of the default parameter set of TOI-1855 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....168...32S/abstract). Temperature 5,359 K from Schulte et al. 2024, the stellar temperature of the default parameter set of TOI-1855 b in the NASA Exoplanet Archive. log g 4.4 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1247603719345703808, through the CIE 1931 2° observer: #ffe9d9. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,359 K and log g 4.4 (u1 0.557, u2 0.195): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
