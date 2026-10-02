# K2-55

## Sources

Its radius and temperature follow Howard et al. 2025. The introduction is generated from Howard et al. 2025's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6825931948041984256, parallax 6.300 ± 0.015 mas (158.74 pc). Radius 0.715 +/- 0.043 solar radii from Howard et al. 2025, the stellar radius of the default parameter set of K2-55 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract). Mass 0.688 +/- 0.069 solar masses from Howard et al. 2025, the stellar mass of the default parameter set of K2-55 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract). Temperature 4,300 K from Howard et al. 2025, the stellar temperature of the default parameter set of K2-55 b in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 6825931948041984256, through the CIE 1931 2° observer: #ffc59e. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,300 K and log g 4.57 (u1 0.762, u2 0.031): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
