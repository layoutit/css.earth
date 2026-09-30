# TOI-1266

## Sources

Its radius and temperature follow Greklek-McKeon et al. 2025. The introduction is generated from Greklek-McKeon et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1678074272650459008, parallax 27.740 ± 0.013 mas (36.05 pc). Radius 0.4232 +/- 0.0077 solar radii from Greklek-McKeon et al. 2025, the stellar radius of the default parameter set of TOI-1266 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169..292G/abstract). Mass 0.437 +/- 0.021 solar masses from Greklek-McKeon et al. 2025, the stellar mass of the default parameter set of TOI-1266 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....169..292G/abstract). Temperature 3,563 K from Greklek-McKeon et al. 2025, the stellar temperature of the default parameter set of TOI-1266 b in the NASA Exoplanet Archive. log g 4.83 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1678074272650459008, through the CIE 1931 2° observer: #ffc185. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,563 K and log g 4.83 (u1 0.389, u2 0.376): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-1266 d: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by transit timing variations).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
