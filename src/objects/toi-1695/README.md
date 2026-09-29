# TOI-1695

## Sources

Its radius and temperature follow Cherubim et al. 2023. This account was drafted from Cherubim et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 534988616816537728, parallax 22.226 ± 0.014 mas (44.99 pc). Radius 0.515 +/- 0.015 solar radii from Cherubim et al. 2023, the stellar radius of the default parameter set of TOI-1695 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..167C/abstract). Mass 0.513 +/- 0.012 solar masses from Cherubim et al. 2023, the stellar mass of the default parameter set of TOI-1695 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..167C/abstract). Temperature 3,690 K from Cherubim et al. 2023, the stellar temperature of the default parameter set of TOI-1695 b in the NASA Exoplanet Archive. log g 4.72 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 534988616816537728, through the CIE 1931 2° observer: #ffc88f. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,690 K and log g 4.72 (u1 0.400, u2 0.357): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
