# TOI-500

## Sources

Its radius and temperature follow Serrano et al. 2022. It is also HIP 34269. The introduction is generated from Serrano et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5509620021956148736, parallax 21.093 ± 0.010 mas (47.41 pc). Radius 0.678 +/- 0.016 solar radii from Serrano et al. 2022, the stellar radius of the default parameter set of TOI-500 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022NatAs...6..736S/abstract). Mass 0.74 +/- 0.017 solar masses from Serrano et al. 2022, the stellar mass of the default parameter set of TOI-500 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022NatAs...6..736S/abstract). Temperature 4,440 K from Serrano et al. 2022, the stellar temperature of the default parameter set of TOI-500 b in the NASA Exoplanet Archive. log g 4.64 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5509620021956148736, through the CIE 1931 2° observer: #ffcbab. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,440 K and log g 4.64 (u1 0.764, u2 0.028): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-500 d: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Not shown.** TOI-500 e: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Not shown.** TOI-500 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
