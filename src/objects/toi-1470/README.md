# TOI-1470

## Sources

Its radius and temperature follow González-Álvarez et al. 2023. The introduction is generated from González-Álvarez et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 427224073427887360, parallax 19.328 ± 0.013 mas (51.74 pc). Radius 0.469 +/- 0.003 solar radii from González-Álvarez et al. 2023, the stellar radius of the default parameter set of TOI-1470 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...675A.177G/abstract). Mass 0.471 +/- 0.011 solar masses from González-Álvarez et al. 2023, the stellar mass of the default parameter set of TOI-1470 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...675A.177G/abstract). Temperature 3,709 K from González-Álvarez et al. 2023, the stellar temperature of the default parameter set of TOI-1470 b in the NASA Exoplanet Archive. log g 4.77 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 427224073427887360, through the CIE 1931 2° observer: #ffc288. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,709 K and log g 4.77 (u1 0.389, u2 0.364): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
