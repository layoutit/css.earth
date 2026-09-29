# TOI-815

## Sources

Its radius and temperature follow Psaridi et al. 2024. This account was drafted from Psaridi et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5415648821879172096, parallax 16.824 ± 0.013 mas (59.44 pc). Radius 0.77 +/- 0.009 solar radii from Psaridi et al. 2024, the stellar radius of the default parameter set of TOI-815 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...685A...5P/abstract). Mass 0.776 +/- 0.036 solar masses from Psaridi et al. 2024, the stellar mass of the default parameter set of TOI-815 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...685A...5P/abstract). Temperature 4,869 K from Psaridi et al. 2024, the stellar temperature of the default parameter set of TOI-815 b in the NASA Exoplanet Archive. log g 4.55 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5415648821879172096, through the CIE 1931 2° observer: #ffdfca. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,869 K and log g 4.55 (u1 0.693, u2 0.090): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-815 c: Psaridi et al. 2024's a/R* 53.9 disagrees with Kepler's third law (408.85 from P 734.4987702 d, Psaridi et al. 2024's stellar mass 0.776 and Psaridi et al. 2024's radius 0.77 solar units) by a factor of 7.6, beyond 2.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
