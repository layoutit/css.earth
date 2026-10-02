# TOI-238

## Sources

Its radius and temperature follow Egger et al. 2025. The introduction is generated from Egger et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2405081733281425280, parallax 12.475 ± 0.015 mas (80.16 pc). Radius 0.756 +/- 0.007 solar radii from Egger et al. 2025, the stellar radius of the default parameter set of TOI-238 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...696A..28E/abstract). Mass 0.781 +/- 0.04 solar masses from Egger et al. 2025, the stellar mass of the default parameter set of TOI-238 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...696A..28E/abstract). Temperature 5,059 K from Egger et al. 2025, the stellar temperature of the default parameter set of TOI-238 b in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2405081733281425280, through the CIE 1931 2° observer: #ffe1cf. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,059 K and log g 4.57 (u1 0.640, u2 0.132): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
