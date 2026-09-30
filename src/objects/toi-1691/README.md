# TOI-1691

## Sources

Its radius and temperature follow Crossfield et al. 2025. The introduction is generated from Crossfield et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2303587361109316224, parallax 8.887 ± 0.013 mas (112.52 pc). Radius 1 +/- 0.05 solar radii from Crossfield et al. 2025, the stellar radius of the default parameter set of TOI-1691 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169...89C/abstract). Mass 1.03 +/- 0.14 solar masses from Crossfield et al. 2025, the stellar mass of the default parameter set of TOI-1691 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169...89C/abstract). Temperature 5,759 K from Crossfield et al. 2025, the stellar temperature of the default parameter set of TOI-1691 b in the NASA Exoplanet Archive. log g 4.45 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2303587361109316224, through the CIE 1931 2° observer: #fff2ef. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,759 K and log g 4.45 (u1 0.462, u2 0.258): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
