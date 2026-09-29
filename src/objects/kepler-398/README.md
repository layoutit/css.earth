# Kepler-398

## Sources

Its radius and temperature follow Rowe et al. 2014. This account was drafted from Rowe et al. 2014's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2053457644144430848, parallax 5.633 ± 0.011 mas (177.51 pc). Radius 0.613 +/- 0.028 solar radii from Rowe et al. 2014, the stellar radius of the default parameter set of Kepler-398 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014ApJ...784...45R/abstract). Mass 0.723 +/- 0.081276 solar masses from TICv8, the stellar mass of Kepler-398 c's parameter set from TICv8 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158..138S/abstract). Temperature 4,493 K from Rowe et al. 2014, the stellar temperature of the default parameter set of Kepler-398 b in the NASA Exoplanet Archive. log g 4.72 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2053457644144430848, through the CIE 1931 2° observer: #ffcaa8. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,493 K and log g 4.72 (u1 0.766, u2 0.027): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
