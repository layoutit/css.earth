# TOI-1260

## Sources

Its radius and temperature follow Lam et al. 2023. The introduction is generated from Lam et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1053809778428567680, parallax 13.623 ± 0.015 mas (73.41 pc). Radius 0.672 +/- 0.01 solar radii from Lam et al. 2023, the stellar radius of the default parameter set of TOI-1260 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.519.1437L/abstract). Mass 0.679 +/- 0.095 solar masses from Lam et al. 2023, the stellar mass of the default parameter set of TOI-1260 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.519.1437L/abstract). Temperature 4,227 K from Lam et al. 2023, the stellar temperature of the default parameter set of TOI-1260 b in the NASA Exoplanet Archive. log g 4.62 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1053809778428567680, through the CIE 1931 2° observer: #ffc49d. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,227 K and log g 4.62 (u1 0.723, u2 0.063): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-1260" (revision 1374438825) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
