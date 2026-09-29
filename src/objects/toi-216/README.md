# TOI-216

## Sources

Its radius follows Dawson et al. 2021, and its temperature Kipping et al. 2019. This account was drafted from Dawson et al. 2021's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4664811297844004352, parallax 5.615 ± 0.010 mas (178.09 pc). Radius 0.748 +/- 0.015 solar radii from Dawson et al. 2021, the stellar radius of the default parameter set of TOI-216.02 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161..161D/abstract). Mass 0.77 +/- 0.03 solar masses from Dawson et al. 2021, the stellar mass of the default parameter set of TOI-216.02 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161..161D/abstract). Temperature 5,026 K from Kipping et al. 2019, the stellar temperature of TOI-216.02's parameter set from Kipping et al. 2019 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 4664811297844004352, through the CIE 1931 2° observer: #ffddc5. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,026 K and log g 4.58 (u1 0.650, u2 0.125): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
