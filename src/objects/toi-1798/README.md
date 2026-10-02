# TOI-1798

## Sources

Its radius and temperature follow Crossfield et al. 2025. The introduction is generated from Crossfield et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1505890751741673856, parallax 8.780 ± 0.014 mas (113.90 pc). Radius 0.78 +/- 0.04 solar radii from Crossfield et al. 2025, the stellar radius of the default parameter set of TOI-1798.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169...89C/abstract). Mass 0.87 +/- 0.11 solar masses from Crossfield et al. 2025, the stellar mass of the default parameter set of TOI-1798.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169...89C/abstract). Temperature 5,165 K from Crossfield et al. 2025, the stellar temperature of the default parameter set of TOI-1798.01 in the NASA Exoplanet Archive. log g 4.59 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1505890751741673856, through the CIE 1931 2° observer: #ffe4d2. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,165 K and log g 4.59 (u1 0.611, u2 0.155): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-1798.02: Polanski et al. 2024's mass 0.01761957 Jupiter masses in 0.13060956 Jupiter radii is 9.8 g/cm^3, outside what the records accept.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
