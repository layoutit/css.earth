# Nushagak

## Sources

Its radius and temperature follow Kane et al. 2023. It is also HD 17156, HIP 13192. The introduction is generated from Kane et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 545560867790611072, parallax 12.914 ± 0.018 mas (77.43 pc). Radius 1.517 +/- 0.038 solar radii from Kane et al. 2023, the stellar radius of the default parameter set of HD 17156 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..252K/abstract). Mass 1.285 +/- 0.064 solar masses from Kane et al. 2023, the stellar mass of the default parameter set of HD 17156 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..252K/abstract). Temperature 6,046 K from Kane et al. 2023, the stellar temperature of the default parameter set of HD 17156 b in the NASA Exoplanet Archive. log g 4.18 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 545560867790611072, through the CIE 1931 2° observer: #fff7fd. Routes tried in order: stis-ngsl: HD 17156 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,046 K and log g 4.18 (u1 0.406, u2 0.291): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 17156" (revision 1370777783) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
