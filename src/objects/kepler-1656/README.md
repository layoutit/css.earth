# Kepler-1656

## Sources

Its radius follows Angelo et al. 2022, and its temperature TICv8. The introduction is generated from Angelo et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2103392720630278656, parallax 5.317 ± 0.010 mas (188.06 pc). Radius 1.1 +/- 0.13 solar radii from Angelo et al. 2022, the stellar radius of the default parameter set of Kepler-1656 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..227A/abstract). Mass 1.03 +/- 0.04 solar masses from Angelo et al. 2022, the stellar mass of the default parameter set of Kepler-1656 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..227A/abstract). Temperature 5,696 K from TICv8, the stellar temperature of Kepler-1656 b's parameter set from TICv8 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.37 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2103392720630278656, through the CIE 1931 2° observer: #fff0eb. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,696 K and log g 4.37 (u1 0.475, u2 0.250): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Kepler-1656 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
