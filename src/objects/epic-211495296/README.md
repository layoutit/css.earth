# EPIC 211495296

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.87 solar masses and 18.7 solar radii; GALAH spectra give 4,922 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 605349222027952512, distance 10,330 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211495296 (K2 campaign 5): PARAM asteroseismic distance (pc) 10330 (16th-84th percentiles 10061.171875-10624.21875), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.120 ± 0.024 mas (5.0 standard errors), is not used. Radius 18.7065 +/- 1.5446 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211495296 (K2 campaign 5): PARAM radius (solar radii) 18.706517 (16th-84th percentiles 16.743875-19.833094), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.8703 +/- 0.3272 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211495296 (K2 campaign 5): PARAM mass (solar masses) 1.870343 (16th-84th percentiles 1.460146-2.114514), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,922 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211495296: GALAH DR3 effective temperature 4922.281 +/- 190 K (the catalogue's final uncertainty). log g 2.17 from the mass and radius.

**Color.** A Planck spectrum at 4,922 K, because pARAM fits an extinction A_V = -0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the color routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,922 K and log g 2.17 (u1 0.644, u2 0.136): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
