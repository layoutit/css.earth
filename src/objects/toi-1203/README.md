# TOI-1203

## Sources

Its radius and temperature follow Gandolfi et al. 2025. It is also HD 97507, HIP 54779. This account was drafted from Gandolfi et al. 2025's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5402390257832925952, parallax 15.393 ± 0.018 mas (64.96 pc). Radius 1.179 +/- 0.011 solar radii from Gandolfi et al. 2025, the stellar radius of the default parameter set of TOI-1203.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025arXiv250910136G/abstract). Mass 0.886 +/- 0.036 solar masses from Gandolfi et al. 2025, the stellar mass of the default parameter set of TOI-1203.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025arXiv250910136G/abstract). Temperature 5,737 K from Gandolfi et al. 2025, the stellar temperature of the default parameter set of TOI-1203.01 in the NASA Exoplanet Archive. log g 4.24 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5402390257832925952, through the CIE 1931 2° observer: #fff5f7. Routes tried in order: stis-ngsl: HD 97507 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,737 K and log g 4.24 (u1 0.464, u2 0.257): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-1203 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Not shown.** TOI-1203 b: nothing measured to show (no dayside temperature or archive spectrum; TESS sectors 90, 99, 100 show no 5-sigma dip within 3 sigma (14 min) of its ephemeris (best 82 ± 17 ppm over 14 transits)).
- **Not shown.** TOI-1203 e: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
