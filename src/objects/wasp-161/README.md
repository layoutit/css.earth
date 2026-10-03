# Tislit

## Sources

Its radius and temperature follow Barkaoui et al. 2019. The introduction is generated from Barkaoui et al. 2019's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5751177095877066496, parallax 2.808 ± 0.016 mas (356.15 pc). Radius 1.712 +/- 0.083 solar radii from Barkaoui et al. 2019, the stellar radius of the default parameter set of WASP-161 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157...43B/abstract). Mass 1.39 +/- 0.14 solar masses from Barkaoui et al. 2019, the stellar mass of the default parameter set of WASP-161 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157...43B/abstract). Temperature 6,400 K from Barkaoui et al. 2019, the stellar temperature of the default parameter set of WASP-161 b in the NASA Exoplanet Archive. log g 4.11 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5751177095877066496, through the CIE 1931 2° observer: #f6f2ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,400 K and log g 4.11 (u1 0.361, u2 0.310): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-161" (revision 1329892833) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
