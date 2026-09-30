# Kepler-538

## Sources

Its radius and temperature follow Bonomo et al. 2023. This account was drafted from Bonomo et al. 2023's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2087171453788422528, parallax 6.426 ± 0.012 mas (155.62 pc). Radius 0.8717 +/- 0.0064 solar radii from Bonomo et al. 2023, the stellar radius of the default parameter set of Kepler-538 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Mass 0.892 +/- 0.051 solar masses from Bonomo et al. 2023, the stellar mass of the default parameter set of Kepler-538 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Temperature 5,534 K from Bonomo et al. 2023, the stellar temperature of the default parameter set of Kepler-538 b in the NASA Exoplanet Archive. log g 4.51 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2087171453788422528, through the CIE 1931 2° observer: #ffefe7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,534 K and log g 4.51 (u1 0.514, u2 0.225): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
