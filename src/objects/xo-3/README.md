# XO-3

## Sources

Its radius and temperature follow Rusznak et al. 2025. The introduction is generated from Rusznak et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 470650560779277952, parallax 4.869 ± 0.026 mas (205.39 pc). Radius 1.523 +/- 0.027 solar radii from Rusznak et al. 2025, the stellar radius of the default parameter set of XO-3 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJ...983L..42R/abstract). Mass 1.449 +/- 0.056 solar masses from Rusznak et al. 2025, the stellar mass of the default parameter set of XO-3 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJ...983L..42R/abstract). Temperature 6,970 K from Rusznak et al. 2025, the stellar temperature of the default parameter set of XO-3 b in the NASA Exoplanet Archive. log g 4.23 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 470650560779277952, through the CIE 1931 2° observer: #e9e9ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,970 K and log g 4.23 (u1 0.312, u2 0.331): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "XO-3" (revision 1374434201) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
