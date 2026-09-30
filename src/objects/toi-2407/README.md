# TOI-2407

## Sources

Its radius and temperature follow Janó Muñoz et al. 2025. The introduction is generated from Janó Muñoz et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4847001302277419904, parallax 10.845 ± 0.012 mas (92.21 pc). Radius 0.567 +/- 0.034 solar radii from Janó Muñoz et al. 2025, the stellar radius of the default parameter set of TOI-2407 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025MNRAS.541..630J/abstract). Mass 0.548 +/- 0.016 solar masses from Janó Muñoz et al. 2025, the stellar mass of the default parameter set of TOI-2407 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025MNRAS.541..630J/abstract). Temperature 3,530 K from Janó Muñoz et al. 2025, the stellar temperature of the default parameter set of TOI-2407 b in the NASA Exoplanet Archive. log g 4.67 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 4847001302277419904, through the CIE 1931 2° observer: #ffc88f. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,530 K and log g 4.67 (u1 0.415, u2 0.360): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
