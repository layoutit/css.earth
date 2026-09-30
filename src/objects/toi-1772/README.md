# TOI-1772

## Sources

Its radius and temperature follow Crossfield et al. 2025. This account was drafted from Crossfield et al. 2025's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 749676822006222464, parallax 10.272 ± 0.014 mas (97.35 pc). Radius 0.995 +/- 0.046 solar radii from Crossfield et al. 2025, the stellar radius of the default parameter set of TOI-1772.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169...89C/abstract). Mass 0.99 +/- 0.13 solar masses from Crossfield et al. 2025, the stellar mass of the default parameter set of TOI-1772.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169...89C/abstract). Temperature 5,583 K from Crossfield et al. 2025, the stellar temperature of the default parameter set of TOI-1772.01 in the NASA Exoplanet Archive. log g 4.44 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 749676822006222464, through the CIE 1931 2° observer: #fff1ee. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,583 K and log g 4.44 (u1 0.502, u2 0.233): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
