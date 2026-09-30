# TOI-1272

## Sources

Its radius and temperature follow Mancini et al. 2026. This account was drafted from Mancini et al. 2026's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1556242405699527424, parallax 7.260 ± 0.011 mas (137.74 pc). Radius 0.8 +/- 0.011 solar radii from Mancini et al. 2026, the stellar radius of the default parameter set of TOI-1272 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...712A.147M/abstract). Mass 0.828 +/- 0.037 solar masses from Mancini et al. 2026, the stellar mass of the default parameter set of TOI-1272 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...712A.147M/abstract). Temperature 4,985 K from Mancini et al. 2026, the stellar temperature of the default parameter set of TOI-1272 b in the NASA Exoplanet Archive. log g 4.55 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1556242405699527424, through the CIE 1931 2° observer: #ffe0ca. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,985 K and log g 4.55 (u1 0.661, u2 0.116): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
