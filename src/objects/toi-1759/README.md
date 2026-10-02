# TOI-1759

## Sources

Its radius and temperature follow Espinoza et al. 2022. The introduction is generated from Espinoza et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2216420110788943744, parallax 24.922 ± 0.010 mas (40.12 pc). Radius 0.597 +/- 0.015 solar radii from Espinoza et al. 2022, the stellar radius of the default parameter set of TOI-1759 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..133E/abstract). Mass 0.606 +/- 0.02 solar masses from Espinoza et al. 2022, the stellar mass of the default parameter set of TOI-1759 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..133E/abstract). Temperature 4,065 K from Espinoza et al. 2022, the stellar temperature of the default parameter set of TOI-1759 b in the NASA Exoplanet Archive. log g 4.67 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2216420110788943744, through the CIE 1931 2° observer: #ffbf8f. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,065 K and log g 4.67 (u1 0.590, u2 0.177): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
