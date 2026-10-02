# TOI-837

## Sources

Its radius and temperature follow Barragán et al. 2024. The introduction is generated from Barragán et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5251470948229949568, parallax 7.011 ± 0.012 mas (142.64 pc). Radius 1.052 +/- 0.012 solar radii from Barragán et al. 2024, the stellar radius of the default parameter set of TOI-837 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.531.4275B/abstract). Mass 1.142 +/- 0.008 solar masses from Barragán et al. 2024, the stellar mass of the default parameter set of TOI-837 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.531.4275B/abstract). Temperature 5,995 K from Barragán et al. 2024, the stellar temperature of the default parameter set of TOI-837 b in the NASA Exoplanet Archive. log g 4.45 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5251470948229949568, through the CIE 1931 2° observer: #fff3f4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,995 K and log g 4.45 (u1 0.416, u2 0.286): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
