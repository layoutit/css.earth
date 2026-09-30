# K2-321

## Sources

Its radius and temperature follow Thygesen et al. 2023. This account was drafted from Thygesen et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3856449627544923392, parallax 12.993 ± 0.023 mas (76.96 pc); its RUWE is 1.5, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.595 +/- 0.031 solar radii from Thygesen et al. 2023, the stellar radius of the default parameter set of K2-321 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..155T/abstract). Mass 0.578 +/- 0.03 solar masses from Thygesen et al. 2023, the stellar mass of the default parameter set of K2-321 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..155T/abstract). Temperature 3,750 K from Thygesen et al. 2023, the stellar temperature of the default parameter set of K2-321 b in the NASA Exoplanet Archive. log g 4.65 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3856449627544923392, through the CIE 1931 2° observer: #ffc48d. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,750 K and log g 4.65 (u1 0.413, u2 0.341): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
