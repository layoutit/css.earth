# TOI-2537

## Sources

Its radius and temperature follow Heidari et al. 2025. The introduction is generated from Heidari et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 12320268307415552, parallax 5.493 ± 0.018 mas (182.05 pc). Radius 0.771 +/- 0.039 solar radii from Heidari et al. 2025, the stellar radius of the default parameter set of TOI-2537 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...694A..36H/abstract). Mass 0.771 +/- 0.049 solar masses from Heidari et al. 2025, the stellar mass of the default parameter set of TOI-2537 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...694A..36H/abstract). Temperature 4,870 K from Heidari et al. 2025, the stellar temperature of the default parameter set of TOI-2537 b in the NASA Exoplanet Archive. log g 4.55 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 12320268307415552, through the CIE 1931 2° observer: #ffd1ad. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,870 K and log g 4.55 (u1 0.693, u2 0.090): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-2537 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
