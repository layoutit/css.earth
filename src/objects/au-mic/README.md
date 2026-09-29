# AU Mic

## Sources

Its radius and temperature follow Mallorquín et al. 2024. It is also HD 197481, HIP 102409. This account was drafted from Mallorquín et al. 2024's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6794047652729201024, parallax 102.943 ± 0.023 mas (9.71 pc). Radius 0.862 +/- 0.052 solar radii from Mallorquín et al. 2024, the stellar radius of the default parameter set of AU Mic b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...689A.132M/abstract). Mass 0.635 +/- 0.04 solar masses from Mallorquín et al. 2024, the stellar mass of the default parameter set of AU Mic b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...689A.132M/abstract). Temperature 3,540 K from Mallorquín et al. 2024, the stellar temperature of the default parameter set of AU Mic b in the NASA Exoplanet Archive. log g 4.37 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 6794047652729201024, through the CIE 1931 2° observer: #ffc08b. Routes tried in order: stis-ngsl: HD 197481 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,540 K and log g 4.37 (u1 0.476, u2 0.311): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** AU Mic d: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by transit timing variations).
- **Not shown.** AU Mic e: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "AU Microscopii" (revision 1376711247), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
