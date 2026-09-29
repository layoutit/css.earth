# Kepler-1512

## Sources

Its radius and temperature follow Morton et al. 2016. This account was drafted from Morton et al. 2016's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2127115783511206016, parallax 3.567 ± 0.138 mas (280.33 pc); its RUWE is 7.8, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.67 +/- 0.017 solar radii from Morton et al. 2016, the stellar radius of the default parameter set of Kepler-1512 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...822...86M/abstract). Mass 0.73 +/- 0.022 solar masses from Morton et al. 2016, the stellar mass of the default parameter set of Kepler-1512 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...822...86M/abstract). Temperature 4,372 K from Morton et al. 2016, the stellar temperature of the default parameter set of Kepler-1512 b in the NASA Exoplanet Archive. log g 4.65 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2127115783511206016, through the CIE 1931 2° observer: #ffcfc0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,372 K and log g 4.65 (u1 0.751, u2 0.040): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
