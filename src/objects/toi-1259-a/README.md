# TOI-1259 A

## Sources

Its radius follows Veldhuis et al. 2026, and its temperature Martin et al. 2021. The introduction is generated from Veldhuis et al. 2026's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2294170838587572736, parallax 8.409 ± 0.011 mas (118.92 pc). Radius 0.715 +/- 0.015 solar radii from Veldhuis et al. 2026, the stellar radius of the default parameter set of TOI-1259 A b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...708A.272V/abstract). Mass 0.746 +/- 0.048 solar masses from Veldhuis et al. 2026, the stellar mass of the default parameter set of TOI-1259 A b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...708A.272V/abstract). Temperature 4,775 K from Martin et al. 2021, the stellar temperature of TOI-1259 A b's parameter set from Martin et al. 2021 (the default leaves it empty) in the NASA Exoplanet Archive. log g 4.6 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 2294170838587572736, through the CIE 1931 2° observer: #ffd2b6. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,775 K and log g 4.6 (u1 0.719, u2 0.068): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
