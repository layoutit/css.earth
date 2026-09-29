# Kepler-378

## Sources

Its radius and temperature follow Rowe et al. 2014. This account was drafted from Rowe et al. 2014's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2080095512350543744, parallax 6.576 ± 0.009 mas (152.08 pc). Radius 0.671 +/- 0.035 solar radii from Rowe et al. 2014, the stellar radius of the default parameter set of Kepler-378 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014ApJ...784...45R/abstract). Mass 0.753 +/- 0.106428 solar masses from TICv8, the stellar mass of Kepler-378 b's parameter set from TICv8 (the default leaves it empty) in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158..138S/abstract). Temperature 4,661 K from Rowe et al. 2014, the stellar temperature of the default parameter set of Kepler-378 b in the NASA Exoplanet Archive. log g 4.66 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2080095512350543744, through the CIE 1931 2° observer: #ffd2b6. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,661 K and log g 4.66 (u1 0.743, u2 0.047): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
