# TOI-969

## Sources

Its radius and temperature follow Lillo-Box et al. 2023. The introduction is generated from Lillo-Box et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3087206553745290624, parallax 12.849 ± 0.023 mas (77.83 pc). Radius 0.671 +/- 0.015 solar radii from Lillo-Box et al. 2023, the stellar radius of the default parameter set of TOI-969 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...669A.109L/abstract). Mass 0.734 +/- 0.014 solar masses from Lillo-Box et al. 2023, the stellar mass of the default parameter set of TOI-969 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...669A.109L/abstract). Temperature 4,435 K from Lillo-Box et al. 2023, the stellar temperature of the default parameter set of TOI-969 b in the NASA Exoplanet Archive. log g 4.65 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 3087206553745290624, through the CIE 1931 2° observer: #ffc8a3. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,435 K and log g 4.65 (u1 0.762, u2 0.030): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-969 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
