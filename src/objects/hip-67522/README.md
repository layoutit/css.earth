# HIP 67522

## Sources

Its radius and temperature follow Barber et al. 2024. It is also HD 120411. The introduction is generated from Barber et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6113920619134019456, parallax 8.017 ± 0.018 mas (124.73 pc). Radius 1.38 +/- 0.06 solar radii from Barber et al. 2024, the stellar radius of the default parameter set of HIP 67522 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...973L..30B/abstract). Mass 1.22 +/- 0.05 solar masses from Barber et al. 2024, the stellar mass of the default parameter set of HIP 67522 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...973L..30B/abstract). Temperature 5,675 K from Barber et al. 2024, the stellar temperature of the default parameter set of HIP 67522 b in the NASA Exoplanet Archive. log g 4.24 from the mass and radius.

**Colour.** A Planck spectrum at 5,675 K, because no archive holds a spectrum of this star (stis-ngsl: HD 120411 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffefe7. Routes tried in order: stis-ngsl: HD 120411 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,675 K and log g 4.24 (u1 0.478, u2 0.248): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HIP 67522" (revision 1374404438) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
