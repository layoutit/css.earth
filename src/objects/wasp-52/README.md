# WASP-52

## Sources

Its radius and temperature follow Hebrard et al. 2013. This account was drafted from Hebrard et al. 2013's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2666015878575546496, parallax 5.726 ± 0.013 mas (174.64 pc). Radius 0.79 +/- 0.02 solar radii from Hebrard et al. 2013, the stellar radius of the default parameter set of WASP-52 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013A&A...549A.134H/abstract). Mass 0.87 +/- 0.03 solar masses from Hebrard et al. 2013, the stellar mass of the default parameter set of WASP-52 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013A&A...549A.134H/abstract). Temperature 5,000 K from Hebrard et al. 2013, the stellar temperature of the default parameter set of WASP-52 b in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Colour.** A Planck spectrum at 5,000 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,000 K and log g 4.58 (u1 0.657, u2 0.119): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "WASP-52" (revision 1374437761), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
