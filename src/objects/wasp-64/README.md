# Atakoraka

## Sources

Its radius and temperature follow Gillon et al. 2013. The introduction is generated from Gillon et al. 2013's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5583523425437258240, parallax 2.772 ± 0.010 mas (360.73 pc). Radius 1.058 +/- 0.025 solar radii from Gillon et al. 2013, the stellar radius of the default parameter set of WASP-64 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013A&A...552A..82G/abstract). Mass 1.004 +/- 0.028 solar masses from Gillon et al. 2013, the stellar mass of the default parameter set of WASP-64 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013A&A...552A..82G/abstract). Temperature 5,400 K from Gillon et al. 2013, the stellar temperature of the default parameter set of WASP-64 b in the NASA Exoplanet Archive. log g 4.39 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5583523425437258240, through the CIE 1931 2° observer: #ffeee5. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,400 K and log g 4.39 (u1 0.546, u2 0.203): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-64" (revision 1370791684) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
