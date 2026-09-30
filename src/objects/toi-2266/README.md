# TOI-2266

## Sources

Its radius and temperature follow Parviainen et al. 2024. This account was drafted from Parviainen et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1319243773843954304, parallax 19.288 ± 0.019 mas (51.85 pc). Radius 0.24 +/- 0.01 solar radii from Parviainen et al. 2024, the stellar radius of the default parameter set of TOI-2266 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...683A.170P/abstract). Mass 0.23 +/- 0.02 solar masses from Parviainen et al. 2024, the stellar mass of the default parameter set of TOI-2266 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...683A.170P/abstract). Temperature 3,200 K from Parviainen et al. 2024, the stellar temperature of the default parameter set of TOI-2266 b in the NASA Exoplanet Archive. log g 5.04 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1319243773843954304, through the CIE 1931 2° observer: #ffcc80. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,200 K and log g 5.04 (u1 0.154, u2 0.479): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
