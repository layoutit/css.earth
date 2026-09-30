# TOI-782

## Sources

Its radius and temperature follow Hori et al. 2024. This account was drafted from Hori et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3518374197418907648, parallax 19.153 ± 0.020 mas (52.21 pc). Radius 0.413 +/- 0.008 solar radii from Hori et al. 2024, the stellar radius of the default parameter set of TOI-782 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..289H/abstract). Mass 0.397 +/- 0.01 solar masses from Hori et al. 2024, the stellar mass of the default parameter set of TOI-782 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..289H/abstract). Temperature 3,370 K from Hori et al. 2024, the stellar temperature of the default parameter set of TOI-782 b in the NASA Exoplanet Archive. log g 4.8 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3518374197418907648, through the CIE 1931 2° observer: #ffd08f. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,370 K and log g 4.8 (u1 0.164, u2 0.447): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
