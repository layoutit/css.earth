# TOI-3785

## Sources

Its radius and temperature follow Powers et al. 2023. This account was drafted from Powers et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1044013542142711296, parallax 12.546 ± 0.014 mas (79.70 pc). Radius 0.5 +/- 0.01 solar radii from Powers et al. 2023, the stellar radius of the default parameter set of TOI-3785 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...44P/abstract). Mass 0.52 +/- 0.02 solar masses from Powers et al. 2023, the stellar mass of the default parameter set of TOI-3785 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...44P/abstract). Temperature 3,576 K from Powers et al. 2023, the stellar temperature of the default parameter set of TOI-3785 b in the NASA Exoplanet Archive. log g 4.76 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1044013542142711296, through the CIE 1931 2° observer: #ffc78a. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,576 K and log g 4.76 (u1 0.399, u2 0.368): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
