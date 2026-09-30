# TOI-2989

## Sources

Its radius and temperature follow Frensch et al. 2025. The introduction is generated from Frensch et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3531594209836279168, parallax 5.130 ± 0.016 mas (194.92 pc). Radius 0.76 +/- 0.03 solar radii from Frensch et al. 2025, the stellar radius of the default parameter set of TOI-2989 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...700A.118F/abstract). Mass 0.77 +/- 0.02 solar masses from Frensch et al. 2025, the stellar mass of the default parameter set of TOI-2989 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...700A.118F/abstract). Temperature 4,672 K from Frensch et al. 2025, the stellar temperature of the default parameter set of TOI-2989 b in the NASA Exoplanet Archive. log g 4.56 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3531594209836279168, through the CIE 1931 2° observer: #ffc49c. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,672 K and log g 4.56 (u1 0.744, u2 0.047): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
