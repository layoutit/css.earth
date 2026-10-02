# TOI-1776

## Sources

Its radius and temperature follow MacDougall et al. 2023. It is also HD 95072, HIP 53688. The introduction is generated from MacDougall et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 778052193462283648, parallax 22.346 ± 0.033 mas (44.75 pc). Radius 0.9356 +/- 0.0164 solar radii from MacDougall et al. 2023, the stellar radius of the default parameter set of TOI-1776 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Mass 0.9196 +/- 0.0328 solar masses from MacDougall et al. 2023, the stellar mass of the default parameter set of TOI-1776 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Temperature 5,785 K from MacDougall et al. 2023, the stellar temperature of the default parameter set of TOI-1776 b in the NASA Exoplanet Archive. log g 4.46 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 778052193462283648, through the CIE 1931 2° observer: #fff5f5. Routes tried in order: stis-ngsl: HD 95072 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,785 K and log g 4.46 (u1 0.457, u2 0.261): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
