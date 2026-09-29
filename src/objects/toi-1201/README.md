# TOI-1201

## Sources

Its radius and temperature follow Kossakowski et al. 2021. This account was drafted from Kossakowski et al. 2021's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5157183324996790272, parallax 26.571 ± 0.022 mas (37.64 pc); its RUWE is 1.5, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.508 +/- 0.016 solar radii from Kossakowski et al. 2021, the stellar radius of the default parameter set of TOI-1201 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021A&A...656A.124K/abstract). Mass 0.512 +/- 0.02 solar masses from Kossakowski et al. 2021, the stellar mass of the default parameter set of TOI-1201 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021A&A...656A.124K/abstract). Temperature 3,476 K from Kossakowski et al. 2021, the stellar temperature of the default parameter set of TOI-1201 b in the NASA Exoplanet Archive. log g 4.74 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5157183324996790272, through the CIE 1931 2° observer: #ffc88c. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,476 K and log g 4.74 (u1 0.177, u2 0.429): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
