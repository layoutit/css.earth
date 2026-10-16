# WASP-65

## Sources

Its radius and temperature follow Gomez et al. 2013. The introduction is generated from Gomez et al. 2013's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 596931979481073152, parallax 3.636 ± 0.020 mas (275.01 pc). Radius 1.01 +/- 0.05 solar radii from Gomez et al. 2013, the stellar radius of the default parameter set of WASP-65 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013A&A...559A..36G/abstract). Mass 0.93 +/- 0.14 solar masses from Gomez et al. 2013, the stellar mass of the default parameter set of WASP-65 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013A&A...559A..36G/abstract). Temperature 5,600 K from Gomez et al. 2013, the stellar temperature of the default parameter set of WASP-65 b in the NASA Exoplanet Archive. log g 4.4 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 596931979481073152, through the CIE 1931 2° observer: #fff0eb. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,600 K and log g 4.4 (u1 0.498, u2 0.235): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
