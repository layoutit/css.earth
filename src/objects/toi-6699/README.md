# TOI-6699

## Sources

Its radius and temperature follow Lafarga et al. 2026. The introduction is generated from Lafarga et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6450063790712030336, parallax 11.621 ± 0.016 mas (86.05 pc). Radius 0.75309 solar radii from Lafarga et al. 2026, the stellar radius of the default parameter set of TOI-6699 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.548ag512L/abstract). Mass 0.747 (0.707 to 0.795) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 4,705.1 K from Lafarga et al. 2026, the stellar temperature of the default parameter set of TOI-6699 b in the NASA Exoplanet Archive. log g 4.56 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 6450063790712030336, through the CIE 1931 2° observer: #ffd7bd. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,705.1 K and log g 4.56 (u1 0.736, u2 0.054): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
