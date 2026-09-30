# TOI-1670

## Sources

Its radius and temperature follow Tran et al. 2022. The introduction is generated from Tran et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1651911084230149248, parallax 6.022 ± 0.013 mas (166.05 pc). Radius 1.316 +/- 0.019 solar radii from Tran et al. 2022, the stellar radius of the default parameter set of TOI-1670 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..225T/abstract). Mass 1.21 +/- 0.02 solar masses from Tran et al. 2022, the stellar mass of the default parameter set of TOI-1670 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..225T/abstract). Temperature 6,170 K from Tran et al. 2022, the stellar temperature of the default parameter set of TOI-1670 b in the NASA Exoplanet Archive. log g 4.28 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1651911084230149248, through the CIE 1931 2° observer: #f6f2ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,170 K and log g 4.28 (u1 0.388, u2 0.299): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
