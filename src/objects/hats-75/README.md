# HATS-75

## Sources

Its radius and temperature follow Jordán et al. 2022. This account was drafted from Jordán et al. 2022's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5082914338199586560, parallax 5.061 ± 0.021 mas (197.60 pc). Radius 0.5848 +/- 0.0026 solar radii from Jordán et al. 2022, the stellar radius of the default parameter set of HATS-75 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..125J/abstract). Mass 0.6017 +/- 0.0074 solar masses from Jordán et al. 2022, the stellar mass of the default parameter set of HATS-75 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..125J/abstract). Temperature 3,790.4 K from Jordán et al. 2022, the stellar temperature of the default parameter set of HATS-75 b in the NASA Exoplanet Archive. log g 4.68 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5082914338199586560, through the CIE 1931 2° observer: #ffc38a. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,790.4 K and log g 4.68 (u1 0.428, u2 0.326): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
