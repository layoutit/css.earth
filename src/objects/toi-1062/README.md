# TOI-1062

## Sources

Its radius and temperature follow Otegi et al. 2021. The introduction is generated from Otegi et al. 2021's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4632865331094140928, parallax 12.144 ± 0.010 mas (82.35 pc). Radius 0.84 +/- 0.09 solar radii from Otegi et al. 2021, the stellar radius of the default parameter set of TOI-1062 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021A&A...653A.105O/abstract). Mass 0.94 +/- 0.02 solar masses from Otegi et al. 2021, the stellar mass of the default parameter set of TOI-1062 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021A&A...653A.105O/abstract). Temperature 5,328 K from Otegi et al. 2021, the stellar temperature of the default parameter set of TOI-1062 b in the NASA Exoplanet Archive. log g 4.56 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 4632865331094140928, through the CIE 1931 2° observer: #ffe7d8. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,328 K and log g 4.56 (u1 0.566, u2 0.188): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-1062 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
