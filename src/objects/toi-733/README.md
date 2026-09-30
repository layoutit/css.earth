# TOI-733

## Sources

Its radius and temperature follow Georgieva et al. 2023. This account was drafted from Georgieva et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5392409372314518656, parallax 13.285 ± 0.013 mas (75.27 pc). Radius 0.949 +/- 0.008 solar radii from Georgieva et al. 2023, the stellar radius of the default parameter set of TOI-733 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...674A.117G/abstract). Mass 0.956 +/- 0.05 solar masses from Georgieva et al. 2023, the stellar mass of the default parameter set of TOI-733 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...674A.117G/abstract). Temperature 5,585 K from Georgieva et al. 2023, the stellar temperature of the default parameter set of TOI-733 b in the NASA Exoplanet Archive. log g 4.46 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5392409372314518656, through the CIE 1931 2° observer: #fff2ef. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,585 K and log g 4.46 (u1 0.502, u2 0.233): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
