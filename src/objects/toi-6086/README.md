# TOI-6086

## Sources

Its radius and temperature follow Barkaoui et al. 2024. The introduction is generated from Barkaoui et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4597447518944594176, parallax 31.767 ± 0.014 mas (31.48 pc). Radius 0.259 +/- 0.013 solar radii from Barkaoui et al. 2024, the stellar radius of the default parameter set of TOI-6086 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...687A.264B/abstract). Mass 0.254 +/- 0.013 solar masses from Barkaoui et al. 2024, the stellar mass of the default parameter set of TOI-6086 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...687A.264B/abstract). Temperature 3,200 K from Barkaoui et al. 2024, the stellar temperature of the default parameter set of TOI-6086 b in the NASA Exoplanet Archive. log g 5.02 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4597447518944594176, through the CIE 1931 2° observer: #ffc87e. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,200 K and log g 5.02 (u1 0.153, u2 0.478): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
