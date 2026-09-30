# TOI-1685

## Sources

Its radius and temperature follow Egger et al. 2025. This account was drafted from Egger et al. 2025's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 252366608956186240, parallax 26.589 ± 0.019 mas (37.61 pc). Radius 0.462 +/- 0.013 solar radii from Egger et al. 2025, the stellar radius of the default parameter set of TOI-1685 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...696A..28E/abstract). Mass 0.466 +/- 0.019 solar masses from Egger et al. 2025, the stellar mass of the default parameter set of TOI-1685 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...696A..28E/abstract). Temperature 3,470 K from Egger et al. 2025, the stellar temperature of the default parameter set of TOI-1685 b in the NASA Exoplanet Archive. log g 4.78 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 252366608956186240, through the CIE 1931 2° observer: #ffc98b. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,470 K and log g 4.78 (u1 0.173, u2 0.431): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
