# WASP-145 A

## Sources

Its radius and temperature follow Hellier et al. 2019. This account was drafted from Hellier et al. 2019's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6458529931463278848, parallax 10.974 ± 0.028 mas (91.13 pc); its RUWE is 1.9, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 0.68 +/- 0.07 solar radii from Hellier et al. 2019, the stellar radius of the default parameter set of WASP-145 A b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019MNRAS.482.1379H/abstract). Mass 0.76 +/- 0.04 solar masses from Hellier et al. 2019, the stellar mass of the default parameter set of WASP-145 A b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019MNRAS.482.1379H/abstract). Temperature 4,900 K from Hellier et al. 2019, the stellar temperature of the default parameter set of WASP-145 A b in the NASA Exoplanet Archive. log g 4.65 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 6458529931463278848, through the CIE 1931 2° observer: #ffd6bd. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,900 K and log g 4.65 (u1 0.685, u2 0.096): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
