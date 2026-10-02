# TOI-411

## Sources

Its radius and temperature follow Garai et al. 2023. It is also HD 22946, HIP 17047. The introduction is generated from Garai et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4848767461548943104, parallax 15.898 ± 0.017 mas (62.90 pc). Radius 1.117 +/- 0.009 solar radii from Garai et al. 2023, the stellar radius of the default parameter set of TOI-411 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...674A..44G/abstract). Mass 1.098 +/- 0.04 solar masses from Garai et al. 2023, the stellar mass of the default parameter set of TOI-411 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...674A..44G/abstract). Temperature 6,169 K from Garai et al. 2023, the stellar temperature of the default parameter set of TOI-411 b in the NASA Exoplanet Archive. log g 4.38 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4848767461548943104, through the CIE 1931 2° observer: #f9f4ff. Routes tried in order: stis-ngsl: HD 22946 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,169 K and log g 4.38 (u1 0.389, u2 0.299): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
