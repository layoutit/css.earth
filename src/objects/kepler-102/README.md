# Kepler-102

## Sources

Its radius and temperature follow Bonomo et al. 2023. The introduction is generated from Bonomo et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2119583201145735808, parallax 9.252 ± 0.010 mas (108.09 pc). Radius 0.724 +/- 0.018 solar radii from Bonomo et al. 2023, the stellar radius of the default parameter set of Kepler-102 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Mass 0.803 +/- 0.021 solar masses from Bonomo et al. 2023, the stellar mass of the default parameter set of Kepler-102 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract). Temperature 4,909 K from Bonomo et al. 2023, the stellar temperature of the default parameter set of Kepler-102 b in the NASA Exoplanet Archive. log g 4.62 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 2119583201145735808, through the CIE 1931 2° observer: #ffd7bd. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,909 K and log g 4.62 (u1 0.682, u2 0.098): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Kepler-102 d: Bonomo et al. 2023's mass 0.00943906 Jupiter masses in 0.10295316 Jupiter radii is 10.7 g/cm^3, outside what the records accept.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-102" (revision 1374438037) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
