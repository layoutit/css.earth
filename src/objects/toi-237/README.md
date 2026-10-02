# TOI-237

## Sources

Its radius and temperature follow Timmermans et al. 2026. The introduction is generated from Timmermans et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2329387852426700800, parallax 26.118 ± 0.033 mas (38.29 pc). Radius 0.2056 +/- 0.0047 solar radii from Timmermans et al. 2026, the stellar radius of the default parameter set of TOI-237 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.549ag710T/abstract). Mass 0.1698 +/- 0.0385 solar masses from Timmermans et al. 2026, the stellar mass of the default parameter set of TOI-237 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.549ag710T/abstract). Temperature 3,226 K from Timmermans et al. 2026, the stellar temperature of the default parameter set of TOI-237 c in the NASA Exoplanet Archive. log g 5.04 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2329387852426700800, through the CIE 1931 2° observer: #ffca79. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,226 K and log g 5.04 (u1 0.153, u2 0.474): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
