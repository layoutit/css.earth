# TOI-778

## Sources

Its radius and temperature follow Clark et al. 2023. It is also HD 115447. This account was drafted from Clark et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3607877948613218304, parallax 6.151 ± 0.019 mas (162.57 pc). Radius 1.71 +/- 0.05 solar radii from Clark et al. 2023, the stellar radius of the default parameter set of TOI-778 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..207C/abstract). Mass 1.4 +/- 0.05 solar masses from Clark et al. 2023, the stellar mass of the default parameter set of TOI-778 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..207C/abstract). Temperature 6,643 K from Clark et al. 2023, the stellar temperature of the default parameter set of TOI-778 b in the NASA Exoplanet Archive. log g 4.12 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3607877948613218304, through the CIE 1931 2° observer: #eaeaff. Routes tried in order: stis-ngsl: HD 115447 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,643 K and log g 4.12 (u1 0.338, u2 0.319): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
