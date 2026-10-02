# TOI-1774

## Sources

Its radius and temperature follow Lienhard et al. 2026. It is also HD 85426, HIP 48443. The introduction is generated from Lienhard et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 796063843195758208, parallax 18.572 ± 0.024 mas (53.84 pc). Radius 1.1303 +/- 0.0069 solar radii from Lienhard et al. 2026, the stellar radius of the default parameter set of TOI-1774.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.545f1934L/abstract). Mass 0.991 +/- 0.027 solar masses from Lienhard et al. 2026, the stellar mass of the default parameter set of TOI-1774.01 in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.545f1934L/abstract). Temperature 5,746 K from Lienhard et al. 2026, the stellar temperature of the default parameter set of TOI-1774.01 in the NASA Exoplanet Archive. log g 4.33 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 796063843195758208, through the CIE 1931 2° observer: #fff4f3. Routes tried in order: stis-ngsl: HD 85426 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,746 K and log g 4.33 (u1 0.463, u2 0.258): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** HD 85426 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
