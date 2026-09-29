# TOI-620

## Sources

Its radius and temperature follow Reefe et al. 2022. This account was drafted from Reefe et al. 2022's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5738284016370287616, parallax 30.290 ± 0.030 mas (33.01 pc). Radius 0.55 +/- 0.017 solar radii from Reefe et al. 2022, the stellar radius of the default parameter set of TOI-620 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..269R/abstract). Mass 0.577 +/- 0.024 solar masses from Reefe et al. 2022, the stellar mass of the default parameter set of TOI-620 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..269R/abstract). Temperature 3,708 K from Reefe et al. 2022, the stellar temperature of the default parameter set of TOI-620 b in the NASA Exoplanet Archive. log g 4.72 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5738284016370287616, through the CIE 1931 2° observer: #ffc58b. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,708 K and log g 4.72 (u1 0.399, u2 0.356): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
