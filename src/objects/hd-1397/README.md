# HD 1397

## Sources

Its radius and temperature follow Nielsen et al. 2019. It is also HIP 1419. The introduction is generated from Nielsen et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4707634458245031552, parallax 12.493 ± 0.017 mas (80.04 pc). Radius 2.336 +/- 0.052 solar radii from Nielsen et al. 2019, the stellar radius of the default parameter set of HD 1397 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019A&A...623A.100N/abstract). Mass 1.324 +/- 0.042 solar masses from Nielsen et al. 2019, the stellar mass of the default parameter set of HD 1397 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019A&A...623A.100N/abstract). Temperature 5,521 K from Nielsen et al. 2019, the stellar temperature of the default parameter set of HD 1397 b in the NASA Exoplanet Archive. log g 3.82 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 4707634458245031552, through the CIE 1931 2° observer: #ffeee5. Routes tried in order: stis-ngsl: HD 1397 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,521 K and log g 3.82 (u1 0.508, u2 0.229): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
