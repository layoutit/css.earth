# TOI-4529

## Sources

Its radius and temperature follow Poultourtzidis et al. 2026. The introduction is generated from Poultourtzidis et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2584622022068408576, parallax 35.231 ± 0.028 mas (28.38 pc). Radius 0.48 +/- 0.019 solar radii from Poultourtzidis et al. 2026, the stellar radius of the default parameter set of TOI-4529 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...707A.106P/abstract). Mass 0.482 +/- 0.023 solar masses from Poultourtzidis et al. 2026, the stellar mass of the default parameter set of TOI-4529 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...707A.106P/abstract). Temperature 3,697 K from Poultourtzidis et al. 2026, the stellar temperature of the default parameter set of TOI-4529 b in the NASA Exoplanet Archive. log g 4.76 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2584622022068408576, through the CIE 1931 2° observer: #ffc389. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,697 K and log g 4.76 (u1 0.392, u2 0.363): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
