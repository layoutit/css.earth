# TOI-700

## Sources

Its radius follows Pass et al. 2026, and its temperature Gilbert et al. 2023. This account was drafted from Pass et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5284517766615850752, parallax 32.133 ± 0.027 mas (31.12 pc). Radius 0.4104 +/- 0.0093 solar radii from Pass et al. 2026, the stellar radius of the default parameter set of TOI-700 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172..175P/abstract). Mass 0.417 +/- 0.02 solar masses from Pass et al. 2026, the stellar mass of the default parameter set of TOI-700 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172..175P/abstract). Temperature 3,459 K from Gilbert et al. 2023, the stellar temperature of TOI-700 b's parameter set from Gilbert et al. 2023 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.83 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5284517766615850752, through the CIE 1931 2° observer: #ffc789. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,459 K and log g 4.83 (u1 0.169, u2 0.434): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "TOI-700" (revision 1374441870), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
