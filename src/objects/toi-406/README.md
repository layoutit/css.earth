# TOI-406

## Sources

Its radius and temperature follow Lacedelli et al. 2024. The introduction is generated from Lacedelli et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4851053999056603904, parallax 32.354 ± 0.018 mas (30.91 pc). Radius 0.41 +/- 0.029 solar radii from Lacedelli et al. 2024, the stellar radius of the default parameter set of TOI-406 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...692A.238L/abstract). Mass 0.408 +/- 0.046 solar masses from Lacedelli et al. 2024, the stellar mass of the default parameter set of TOI-406 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...692A.238L/abstract). Temperature 3,392 K from Lacedelli et al. 2024, the stellar temperature of the default parameter set of TOI-406 c in the NASA Exoplanet Archive. log g 4.82 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4851053999056603904, through the CIE 1931 2° observer: #ffce8c. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,392 K and log g 4.82 (u1 0.165, u2 0.444): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
