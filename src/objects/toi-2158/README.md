# TOI-2158

## Sources

Its radius and temperature follow Knudstrup et al. 2022. It is also HD 348661. This account was drafted from Knudstrup et al. 2022's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4525545299652540672, parallax 5.092 ± 0.013 mas (196.40 pc). Radius 1.41 +/- 0.03 solar radii from Knudstrup et al. 2022, the stellar radius of the default parameter set of TOI-2158 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...667A..22K/abstract). Mass 1.12 +/- 0.12 solar masses from Knudstrup et al. 2022, the stellar mass of the default parameter set of TOI-2158 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...667A..22K/abstract). Temperature 5,673 K from Knudstrup et al. 2022, the stellar temperature of the default parameter set of TOI-2158 b in the NASA Exoplanet Archive. log g 4.19 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 4525545299652540672, through the CIE 1931 2° observer: #ffeadb. Routes tried in order: stis-ngsl: HD 348661 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,673 K and log g 4.19 (u1 0.478, u2 0.248): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
