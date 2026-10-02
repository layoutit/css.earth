# K2-376

## Sources

Its radius and temperature follow Christiansen et al. 2022. The introduction is generated from Christiansen et al. 2022's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 690025807939789184, parallax 6.206 ± 0.019 mas (161.14 pc). Radius 1.149 +/- 0.067 solar radii from Christiansen et al. 2022, the stellar radius of the default parameter set of K2-376 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..244C/abstract). Mass 0.908 +/- 0.394 solar masses from Christiansen et al. 2022, the stellar mass of the default parameter set of K2-376 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..244C/abstract). Temperature 5,937 K from Christiansen et al. 2022, the stellar temperature of the default parameter set of K2-376 b in the NASA Exoplanet Archive. log g 4.28 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 690025807939789184, through the CIE 1931 2° observer: #fff6f9. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,937 K and log g 4.28 (u1 0.426, u2 0.280): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
