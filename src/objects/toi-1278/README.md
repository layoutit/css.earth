# TOI-1278

## Sources

Its radius and temperature follow Artigau et al. 2021. The introduction is generated from Artigau et al. 2021's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1867491607542113536, parallax 13.252 ± 0.012 mas (75.46 pc). Radius 0.573 +/- 0.012 solar radii from Artigau et al. 2021, the stellar radius of the default parameter set of TOI-1278 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..144A/abstract). Mass 0.54 +/- 0.02 solar masses from Artigau et al. 2021, the stellar mass of the default parameter set of TOI-1278 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..144A/abstract). Temperature 3,799 K from Artigau et al. 2021, the stellar temperature of the default parameter set of TOI-1278 b in the NASA Exoplanet Archive. log g 4.65 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1867491607542113536, through the CIE 1931 2° observer: #ffbe8a. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 3,799 K and log g 4.65 (u1 0.441, u2 0.315): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
