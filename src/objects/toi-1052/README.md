# TOI-1052

## Sources

Its radius and temperature follow Armstrong et al. 2023. It is also HD 212729. The introduction is generated from Armstrong et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6357524189130820992, parallax 7.741 ± 0.013 mas (129.18 pc). Radius 1.264 +/- 0.033 solar radii from Armstrong et al. 2023, the stellar radius of the default parameter set of TOI-1052 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.524.5804A/abstract). Mass 1.204 +/- 0.025 solar masses from Armstrong et al. 2023, the stellar mass of the default parameter set of TOI-1052 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.524.5804A/abstract). Temperature 6,146 K from Armstrong et al. 2023, the stellar temperature of the default parameter set of TOI-1052 b in the NASA Exoplanet Archive. log g 4.32 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6357524189130820992, through the CIE 1931 2° observer: #fdf7ff. Routes tried in order: stis-ngsl: HD 212729 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,146 K and log g 4.32 (u1 0.392, u2 0.297): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-1052 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
