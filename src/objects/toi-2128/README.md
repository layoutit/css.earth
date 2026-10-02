# TOI-2128

## Sources

Its radius and temperature follow MacDougall et al. 2023. It is also HD 155060, HIP 83827. The introduction is generated from MacDougall et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1334288219648212352, parallax 27.269 ± 0.015 mas (36.67 pc). Radius 1.1174 +/- 0.0239 solar radii from MacDougall et al. 2023, the stellar radius of the default parameter set of TOI-2128 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Mass 1.0251 +/- 0.0381 solar masses from MacDougall et al. 2023, the stellar mass of the default parameter set of TOI-2128 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...33M/abstract). Temperature 5,968 K from MacDougall et al. 2023, the stellar temperature of the default parameter set of TOI-2128 b in the NASA Exoplanet Archive. log g 4.35 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 1334288219648212352, through the CIE 1931 2° observer: #fcf6ff. Routes tried in order: stis-ngsl: HD 155060 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,968 K and log g 4.35 (u1 0.420, u2 0.283): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
