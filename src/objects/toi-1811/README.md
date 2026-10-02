# TOI-1811

## Sources

Its radius and temperature follow Rodriguez et al. 2023. The introduction is generated from Rodriguez et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3962403923821595264, parallax 7.895 ± 0.031 mas (126.66 pc); its RUWE is 1.7, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.769 +/- 0.019 solar radii from Rodriguez et al. 2023, the stellar radius of the default parameter set of TOI-1811 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.521.2765R/abstract). Mass 0.817 +/- 0.033 solar masses from Rodriguez et al. 2023, the stellar mass of the default parameter set of TOI-1811 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.521.2765R/abstract). Temperature 4,766 K from Rodriguez et al. 2023, the stellar temperature of the default parameter set of TOI-1811 b in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3962403923821595264, through the CIE 1931 2° observer: #ffd5b9. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,766 K and log g 4.58 (u1 0.722, u2 0.066): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
