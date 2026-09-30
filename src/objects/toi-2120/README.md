# TOI-2120

## Sources

Its radius and temperature follow Hori et al. 2024. This account was drafted from Hori et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 513299860904522752, parallax 31.072 ± 0.018 mas (32.18 pc). Radius 0.245 +/- 0.006 solar radii from Hori et al. 2024, the stellar radius of the default parameter set of TOI-2120 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..289H/abstract). Mass 0.211 +/- 0.005 solar masses from Hori et al. 2024, the stellar mass of the default parameter set of TOI-2120 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..289H/abstract). Temperature 3,131 K from Hori et al. 2024, the stellar temperature of the default parameter set of TOI-2120 b in the NASA Exoplanet Archive. log g 4.98 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 513299860904522752, through the CIE 1931 2° observer: #ffcb7b. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,131 K and log g 4.98 (u1 0.158, u2 0.491): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
