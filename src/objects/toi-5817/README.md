# TOI-5817

## Sources

Its radius and temperature follow Naponiello et al. 2025. It is also HD 204660, HIP 106097. The introduction is generated from Naponiello et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1790807028049001600, parallax 12.447 ± 0.022 mas (80.34 pc). Radius 1.427 +/- 0.043 solar radii from Naponiello et al. 2025, the stellar radius of the default parameter set of TOI-5817 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...701A..79N/abstract). Mass 0.97 +/- 0.072 solar masses from Naponiello et al. 2025, the stellar mass of the default parameter set of TOI-5817 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...701A..79N/abstract). Temperature 5,770 K from Naponiello et al. 2025, the stellar temperature of the default parameter set of TOI-5817 b in the NASA Exoplanet Archive. log g 4.12 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1790807028049001600, through the CIE 1931 2° observer: #fff5f6. Routes tried in order: stis-ngsl: HD 204660 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,770 K and log g 4.12 (u1 0.456, u2 0.262): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
