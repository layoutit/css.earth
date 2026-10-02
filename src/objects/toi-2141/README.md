# TOI-2141

## Sources

Its radius and temperature follow Luque et al. 2025. The introduction is generated from Luque et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4548496986402688384, parallax 12.957 ± 0.015 mas (77.18 pc). Radius 0.95 +/- 0.007 solar radii from Luque et al. 2025, the stellar radius of the default parameter set of TOI-2141 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...704A.174L/abstract). Mass 0.896 +/- 0.059 solar masses from Luque et al. 2025, the stellar mass of the default parameter set of TOI-2141 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...704A.174L/abstract). Temperature 5,635 K from Luque et al. 2025, the stellar temperature of the default parameter set of TOI-2141 b in the NASA Exoplanet Archive. log g 4.43 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4548496986402688384, through the CIE 1931 2° observer: #fff2f0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,635 K and log g 4.43 (u1 0.490, u2 0.240): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-2141 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Not shown.** TOI-2141 d: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
