# TOI-544

## Sources

Its radius and temperature follow Osborne et al. 2024. It is also HD 290498. The introduction is generated from Osborne et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3220926542276901888, parallax 24.440 ± 0.016 mas (40.92 pc). Radius 0.623 +/- 0.012 solar radii from Osborne et al. 2024, the stellar radius of the default parameter set of TOI-544 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.52711138O/abstract). Mass 0.631 +/- 0.018 solar masses from Osborne et al. 2024, the stellar mass of the default parameter set of TOI-544 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.52711138O/abstract). Temperature 4,169 K from Osborne et al. 2024, the stellar temperature of the default parameter set of TOI-544 b in the NASA Exoplanet Archive. log g 4.65 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3220926542276901888, through the CIE 1931 2° observer: #ffc49e. Routes tried in order: stis-ngsl: HD 290498 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,169 K and log g 4.65 (u1 0.672, u2 0.108): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-544 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
