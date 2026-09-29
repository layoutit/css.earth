# TOI-532

## Sources

Its radius and temperature follow Kanodia et al. 2021. This account was drafted from Kanodia et al. 2021's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3340265717587057536, parallax 7.391 ± 0.018 mas (135.30 pc). Radius 0.612 +/- 0.013 solar radii from Kanodia et al. 2021, the stellar radius of the default parameter set of TOI-532 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..135K/abstract). Mass 0.639 +/- 0.023 solar masses from Kanodia et al. 2021, the stellar mass of the default parameter set of TOI-532 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..135K/abstract). Temperature 3,927 K from Kanodia et al. 2021, the stellar temperature of the default parameter set of TOI-532 b in the NASA Exoplanet Archive. log g 4.67 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3340265717587057536, through the CIE 1931 2° observer: #ffbe8a. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,927 K and log g 4.67 (u1 0.505, u2 0.254): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
