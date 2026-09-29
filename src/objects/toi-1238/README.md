# TOI-1238

## Sources

Its radius and temperature follow González-Álvarez et al. 2022. This account was drafted from González-Álvarez et al. 2022's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1685195530290375168, parallax 14.156 ± 0.012 mas (70.64 pc). Radius 0.58 +/- 0.02 solar radii from González-Álvarez et al. 2022, the stellar radius of the default parameter set of TOI-1238 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...658A.138G/abstract). Mass 0.59 +/- 0.02 solar masses from González-Álvarez et al. 2022, the stellar mass of the default parameter set of TOI-1238 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...658A.138G/abstract). Temperature 4,089 K from González-Álvarez et al. 2022, the stellar temperature of the default parameter set of TOI-1238 c in the NASA Exoplanet Archive. log g 4.68 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1685195530290375168, through the CIE 1931 2° observer: #ffbf8b. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,089 K and log g 4.68 (u1 0.603, u2 0.166): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-1238 b: González-Álvarez et al. 2022's mass 0.01183028 Jupiter masses in 0.10794916 Jupiter radii is 11.7 g/cm^3, outside what the records accept.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
