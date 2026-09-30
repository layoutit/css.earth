# TOI-3568

## Sources

Its radius and temperature follow Martioli et al. 2024. This account was drafted from Martioli et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1950477552581609984, parallax 5.056 ± 0.012 mas (197.79 pc). Radius 0.719 +/- 0.013 solar radii from Martioli et al. 2024, the stellar radius of the default parameter set of TOI-3568 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...690A.312M/abstract). Mass 0.78 +/- 0.02 solar masses from Martioli et al. 2024, the stellar mass of the default parameter set of TOI-3568 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...690A.312M/abstract). Temperature 4,969 K from Martioli et al. 2024, the stellar temperature of the default parameter set of TOI-3568 b in the NASA Exoplanet Archive. log g 4.62 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1950477552581609984, through the CIE 1931 2° observer: #ffd9bf. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,969 K and log g 4.62 (u1 0.666, u2 0.112): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
