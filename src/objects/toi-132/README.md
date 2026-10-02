# TOI-132

## Sources

Its radius and temperature follow Díaz et al. 2020. The introduction is generated from Díaz et al. 2020's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6520880040423258240, parallax 6.081 ± 0.021 mas (164.45 pc). Radius 0.9 +/- 0.02 solar radii from Díaz et al. 2020, the stellar radius of the default parameter set of TOI-132 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020MNRAS.493..973D/abstract). Mass 0.97 +/- 0.06 solar masses from Díaz et al. 2020, the stellar mass of the default parameter set of TOI-132 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020MNRAS.493..973D/abstract). Temperature 5,397 K from Díaz et al. 2020, the stellar temperature of the default parameter set of TOI-132 b in the NASA Exoplanet Archive. log g 4.52 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6520880040423258240, through the CIE 1931 2° observer: #ffe8d8. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,397 K and log g 4.52 (u1 0.548, u2 0.201): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
