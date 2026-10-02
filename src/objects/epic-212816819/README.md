# EPIC 212816819

## Sources

Its oscillations, recorded in K2 campaign 6, give 2.38 solar masses and 15.7 solar radii; APOGEE spectra give 5,022 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3632705780161959040, distance 4,251 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212816819 (K2 campaign 6): PARAM asteroseismic distance (pc) 4250.9375 (16th-84th percentiles 4079.648438-4416.875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.378 ± 0.022 mas (17.2 standard errors), is not used. Radius 15.6854 +/- 0.8044 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212816819 (K2 campaign 6): PARAM radius (solar radii) 15.685357 (16th-84th percentiles 14.860101-16.468817), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.3751 +/- 0.2621 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212816819 (K2 campaign 6): PARAM mass (solar masses) 2.375083 (16th-84th percentiles 2.111451-2.63558), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,022 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212816819: APOGEE DR17 effective temperature 5021.757000000001 +/- 50 K (the catalogue's final uncertainty). log g 2.42 from the mass and radius.

**Color.** A Planck spectrum at 5,022 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,022 K and log g 2.42 (u1 0.618, u2 0.155): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
