# GJ 3473

## Sources

Its radius and temperature follow Kemmer et al. 2020. This account was drafted from Kemmer et al. 2020's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3094290054327367168, parallax 36.611 ± 0.024 mas (27.31 pc). Radius 0.364 +/- 0.012 solar radii from Kemmer et al. 2020, the stellar radius of the default parameter set of GJ 3473 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...642A.236K/abstract). Mass 0.36 +/- 0.016 solar masses from Kemmer et al. 2020, the stellar mass of the default parameter set of GJ 3473 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...642A.236K/abstract). Temperature 3,347 K from Kemmer et al. 2020, the stellar temperature of the default parameter set of GJ 3473 b in the NASA Exoplanet Archive. log g 4.87 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3094290054327367168, through the CIE 1931 2° observer: #ffcf8b. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,347 K and log g 4.87 (u1 0.160, u2 0.451): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** GJ 3473 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
