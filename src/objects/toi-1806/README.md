# TOI-1806

## Sources

Its radius and temperature follow Hord et al. 2024. This account was drafted from Hord et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 733540939112687104, parallax 18.046 ± 0.018 mas (55.41 pc). Radius 0.401575 solar radii from Hord et al. 2024, the stellar radius of the default parameter set of TOI-1806.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..233H/abstract). Mass 0.392935 solar masses from Hord et al. 2024, the stellar mass of the default parameter set of TOI-1806.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..233H/abstract). Temperature 3,272 K from Hord et al. 2024, the stellar temperature of the default parameter set of TOI-1806.01 in the NASA Exoplanet Archive. log g 4.82 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 733540939112687104, through the CIE 1931 2° observer: #ffce88. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,272 K and log g 4.82 (u1 0.159, u2 0.462): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
