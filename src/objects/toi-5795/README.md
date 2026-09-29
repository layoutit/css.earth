# TOI-5795

## Sources

Its radius and temperature follow Manni et al. 2025. This account was drafted from Manni et al. 2025's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4216036349838071424, parallax 6.190 ± 0.021 mas (161.55 pc). Radius 1.082 +/- 0.026 solar radii from Manni et al. 2025, the stellar radius of the default parameter set of TOI-5795 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...701A.230M/abstract). Mass 0.901 +/- 0.055 solar masses from Manni et al. 2025, the stellar mass of the default parameter set of TOI-5795 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...701A.230M/abstract). Temperature 5,715 K from Manni et al. 2025, the stellar temperature of the default parameter set of TOI-5795 b in the NASA Exoplanet Archive. log g 4.32 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 4216036349838071424, through the CIE 1931 2° observer: #fff1ed. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,715 K and log g 4.32 (u1 0.470, u2 0.253): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
