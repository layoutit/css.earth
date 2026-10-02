# TOI-3082

## Sources

Its radius and temperature follow Mistry et al. 2023. The introduction is generated from Mistry et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3509135344808097024, parallax 8.895 ± 0.016 mas (112.42 pc). Radius 0.6847 +/- 0.0613 solar radii from Mistry et al. 2023, the stellar radius of the default parameter set of TOI-3082 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166....9M/abstract). Mass 0.664 +/- 0.0798 solar masses from Mistry et al. 2023, the stellar mass of the default parameter set of TOI-3082 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166....9M/abstract). Temperature 4,263 K from Mistry et al. 2023, the stellar temperature of the default parameter set of TOI-3082 b in the NASA Exoplanet Archive. log g 4.59 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3509135344808097024, through the CIE 1931 2° observer: #ffc49c. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,263 K and log g 4.59 (u1 0.752, u2 0.039): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
