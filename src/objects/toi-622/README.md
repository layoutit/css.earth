# TOI-622

## Sources

Its radius and temperature follow Psaridi et al. 2023. It is also HD 70661. The introduction is generated from Psaridi et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5516690878153930240, parallax 8.151 ± 0.012 mas (122.69 pc). Radius 1.415 +/- 0.047 solar radii from Psaridi et al. 2023, the stellar radius of the default parameter set of TOI-622 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...675A..39P/abstract). Mass 1.313 +/- 0.079 solar masses from Psaridi et al. 2023, the stellar mass of the default parameter set of TOI-622 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...675A..39P/abstract). Temperature 6,400 K from Psaridi et al. 2023, the stellar temperature of the default parameter set of TOI-622 b in the NASA Exoplanet Archive. log g 4.25 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5516690878153930240, through the CIE 1931 2° observer: #f0efff. Routes tried in order: stis-ngsl: HD 70661 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,400 K and log g 4.25 (u1 0.361, u2 0.311): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
