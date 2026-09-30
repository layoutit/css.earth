# TOI-2076

## Sources

Its radius follows Wang et al. 2026, and its temperature Barber et al. 2025. The introduction is generated from Wang et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1490845584382687232, parallax 23.805 ± 0.012 mas (42.01 pc). Radius 0.758 +/- 0.03 solar radii from Wang et al. 2026, the stellar radius of the default parameter set of TOI-2076 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026NatAs..10..818W/abstract). Mass 0.849 +/- 0.026 solar masses from Wang et al. 2026, the stellar mass of the default parameter set of TOI-2076 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026NatAs..10..818W/abstract). Temperature 5,192 K from Barber et al. 2025, the stellar temperature of TOI-2076 e's parameter set from Barber et al. 2025 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.61 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 1490845584382687232, through the CIE 1931 2° observer: #ffe6d7. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,192 K and log g 4.61 (u1 0.603, u2 0.161): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-2076 e: Wang et al. 2026's mass 0.01478785 Jupiter masses in 0.11606765 Jupiter radii is 11.7 g/cm^3, outside what the records accept.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
