# K2-415

## Sources

Its radius and temperature follow Hirano et al. 2023. This account was drafted from Hirano et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 604215144503584640, parallax 45.863 ± 0.020 mas (21.80 pc). Radius 0.1965 +/- 0.0058 solar radii from Hirano et al. 2023, the stellar radius of the default parameter set of K2-415 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..131H/abstract). Mass 0.1635 +/- 0.0041 solar masses from Hirano et al. 2023, the stellar mass of the default parameter set of K2-415 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..131H/abstract). Temperature 3,173 K from Hirano et al. 2023, the stellar temperature of the default parameter set of K2-415 b in the NASA Exoplanet Archive. log g 5.06 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 604215144503584640, through the CIE 1931 2° observer: #ffc978. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,173 K and log g 5.06 (u1 0.156, u2 0.485): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "K2-415" (revision 1374442604), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
