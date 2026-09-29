# WASP-132

## Sources

Its radius and temperature follow Grieves et al. 2025. This account was drafted from Grieves et al. 2025's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6099012478412247296, parallax 8.092 ± 0.019 mas (123.57 pc). Radius 0.758 +/- 0.032 solar radii from Grieves et al. 2025, the stellar radius of the default parameter set of WASP-132 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...693A.144G/abstract). Mass 0.789 +/- 0.039 solar masses from Grieves et al. 2025, the stellar mass of the default parameter set of WASP-132 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...693A.144G/abstract). Temperature 4,686 K from Grieves et al. 2025, the stellar temperature of the default parameter set of WASP-132 c in the NASA Exoplanet Archive. log g 4.58 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 6099012478412247296, through the CIE 1931 2° observer: #ffd4b8. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,686 K and log g 4.58 (u1 0.740, u2 0.050): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** WASP-132 d: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "WASP-132" (revision 1374438495), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
