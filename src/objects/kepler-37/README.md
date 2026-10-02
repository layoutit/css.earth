# Kepler-37

## Sources

Its radius and temperature follow Bonomo et al. 2023. The introduction is generated from Bonomo et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2106674071344722688, parallax 15.625 ± 0.010 mas (64.00 pc). Radius 0.789 +/- 0.0064 solar radii from Bonomo et al. 2023, the stellar radius of the default parameter set of Kepler-37 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Mass 0.79 +/- 0.033 solar masses from Bonomo et al. 2023, the stellar mass of the default parameter set of Kepler-37 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Temperature 5,357 K from Bonomo et al. 2023, the stellar temperature of the default parameter set of Kepler-37 b in the NASA Exoplanet Archive. log g 4.54 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2106674071344722688, through the CIE 1931 2° observer: #ffeee7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,357 K and log g 4.54 (u1 0.558, u2 0.194): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Kepler-37 e: Weiss et al. 2024's mass 0.02548545 Jupiter masses in 0.03300925 Jupiter radii is 878.7 g/cm^3, outside what the records accept.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-37" (revision 1374406300) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
