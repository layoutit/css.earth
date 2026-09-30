# TOI-1442

## Sources

Its radius and temperature follow Giacalone et al. 2022. The introduction is generated from Giacalone et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2265154211335825152, parallax 24.164 ± 0.015 mas (41.38 pc). Radius 0.31 +/- 0.01 solar radii from Giacalone et al. 2022, the stellar radius of the default parameter set of TOI-1442 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...99G/abstract). Mass 0.29 +/- 0.02 solar masses from Giacalone et al. 2022, the stellar mass of the default parameter set of TOI-1442 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...99G/abstract). Temperature 3,330 K from Giacalone et al. 2022, the stellar temperature of the default parameter set of TOI-1442 b in the NASA Exoplanet Archive. log g 4.92 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2265154211335825152, through the CIE 1931 2° observer: #ffca82. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,330 K and log g 4.92 (u1 0.157, u2 0.455): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
