# TOI-2257

## Sources

Its radius and temperature follow Schanche et al. 2022. The introduction is generated from Schanche et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1716345832872291968, parallax 17.283 ± 0.015 mas (57.86 pc). Radius 0.313 +/- 0.015 solar radii from Schanche et al. 2022, the stellar radius of the default parameter set of TOI-2257 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...657A..45S/abstract). Mass 0.328 +/- 0.021 solar masses from Schanche et al. 2022, the stellar mass of the default parameter set of TOI-2257 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...657A..45S/abstract). Temperature 3,430 K from Schanche et al. 2022, the stellar temperature of the default parameter set of TOI-2257 b in the NASA Exoplanet Archive. log g 4.96 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1716345832872291968, through the CIE 1931 2° observer: #ffc683. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,430 K and log g 4.96 (u1 0.159, u2 0.441): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
