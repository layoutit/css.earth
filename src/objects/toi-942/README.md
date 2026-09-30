# TOI-942

## Sources

Its radius follows Wirth et al. 2021, and its temperature Carleo et al. 2021. This account was drafted from Wirth et al. 2021's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2974906868489280768, parallax 6.603 ± 0.015 mas (151.45 pc). Radius 0.894 +/- 0.056 solar radii from Wirth et al. 2021, the stellar radius of the default parameter set of TOI-942 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021ApJ...917L..34W/abstract). Mass 0.822 +/- 0.0079 solar masses from Wirth et al. 2021, the stellar mass of the default parameter set of TOI-942 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021ApJ...917L..34W/abstract). Temperature 4,969 K from Carleo et al. 2021, the stellar temperature of TOI-942 c's parameter set from Carleo et al. 2021 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.45 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2974906868489280768, through the CIE 1931 2° observer: #ffe0cb. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,969 K and log g 4.45 (u1 0.664, u2 0.114): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
