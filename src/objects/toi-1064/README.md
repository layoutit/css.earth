# TOI-1064

## Sources

Its radius and temperature follow Wilson et al. 2022. The introduction is generated from Wilson et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6683371847364921088, parallax 14.562 ± 0.015 mas (68.67 pc). Radius 0.726 +/- 0.007 solar radii from Wilson et al. 2022, the stellar radius of the default parameter set of TOI-1064 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022MNRAS.511.1043W/abstract). Mass 0.748 +/- 0.032 solar masses from Wilson et al. 2022, the stellar mass of the default parameter set of TOI-1064 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022MNRAS.511.1043W/abstract). Temperature 4,734 K from Wilson et al. 2022, the stellar temperature of the default parameter set of TOI-1064 b in the NASA Exoplanet Archive. log g 4.59 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6683371847364921088, through the CIE 1931 2° observer: #ffd4b8. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,734 K and log g 4.59 (u1 0.730, u2 0.059): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
