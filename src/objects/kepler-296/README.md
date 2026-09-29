# Kepler-296

## Sources

Its radius and temperature follow Barclay et al. 2015. This account was drafted from Barclay et al. 2015's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2132069633148965888, parallax 4.554 ± 0.556 mas (219.60 pc); its RUWE is 19.1, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.48 +/- 0.066 solar radii from Barclay et al. 2015, the stellar radius of the default parameter set of Kepler-296 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2015ApJ...809....7B/abstract). Mass 0.498 +/- 0.067 solar masses from Barclay et al. 2015, the stellar mass of the default parameter set of Kepler-296 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2015ApJ...809....7B/abstract). Temperature 3,740 K from Barclay et al. 2015, the stellar temperature of the default parameter set of Kepler-296 c in the NASA Exoplanet Archive. log g 4.77 from the mass and radius.

**Colour.** A Planck spectrum at 3,740 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffcd98. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,740 K and log g 4.77 (u1 0.386, u2 0.363): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "Kepler-296" (revision 1335869754), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
