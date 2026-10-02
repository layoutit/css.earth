# Kepler-96

## Sources

Its radius and temperature follow Marcy et al. 2014. The introduction is generated from Marcy et al. 2014's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2073731161099713408, parallax 8.121 ± 0.011 mas (123.14 pc). Radius 1.02 +/- 0.09 solar radii from Marcy et al. 2014, the stellar radius of the default parameter set of Kepler-96 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014ApJS..210...20M/abstract). Mass 1 +/- 0.06 solar masses from Marcy et al. 2014, the stellar mass of the default parameter set of Kepler-96 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014ApJS..210...20M/abstract). Temperature 5,690 K from Marcy et al. 2014, the stellar temperature of the default parameter set of Kepler-96 b in the NASA Exoplanet Archive. log g 4.42 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2073731161099713408, through the CIE 1931 2° observer: #fff2ee. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,690 K and log g 4.42 (u1 0.477, u2 0.248): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
