# TOI-5678

## Sources

Its radius and temperature follow Ulmer-Moll et al. 2023. The introduction is generated from Ulmer-Moll et al. 2023's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5048310370810634624, parallax 6.099 ± 0.014 mas (163.97 pc). Radius 0.938 +/- 0.007 solar radii from Ulmer-Moll et al. 2023, the stellar radius of the default parameter set of TOI-5678 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...674A..43U/abstract). Mass 0.905 +/- 0.039 solar masses from Ulmer-Moll et al. 2023, the stellar mass of the default parameter set of TOI-5678 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...674A..43U/abstract). Temperature 5,485 K from Ulmer-Moll et al. 2023, the stellar temperature of the default parameter set of TOI-5678 b in the NASA Exoplanet Archive. log g 4.45 from the mass and radius.

**Colour.** Gaia DR3 XP spectrum, source 5048310370810634624, through the CIE 1931 2° observer: #ffeee4. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,485 K and log g 4.45 (u1 0.525, u2 0.218): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
