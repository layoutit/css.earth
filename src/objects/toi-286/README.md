# TOI-286

## Sources

Its radius and temperature follow Hobson et al. 2024. The introduction is generated from Hobson et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5482316880495405056, parallax 16.871 ± 0.012 mas (59.27 pc). Radius 0.78 +/- 0.036 solar radii from Hobson et al. 2024, the stellar radius of the default parameter set of TOI-286 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...688A.216H/abstract). Mass 0.832 +/- 0.049 solar masses from Hobson et al. 2024, the stellar mass of the default parameter set of TOI-286 c in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...688A.216H/abstract). Temperature 5,152 K from Hobson et al. 2024, the stellar temperature of the default parameter set of TOI-286 c in the NASA Exoplanet Archive. log g 4.57 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5482316880495405056, through the CIE 1931 2° observer: #ffe5d4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,152 K and log g 4.57 (u1 0.614, u2 0.153): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** TOI-286 b: Hobson et al. 2024's mass 0.01425297 Jupiter masses in 0.12668413 Jupiter radii is 8.7 g/cm^3, outside what the records accept.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
