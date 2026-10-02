# EPIC 212667967

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.97 solar masses and 8.0 solar radii; APOGEE spectra give 4,980 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3615917337117123584, distance 4,932 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212667967 (K2 campaign 6): PARAM asteroseismic distance (pc) 4931.914062 (16th-84th percentiles 4775.585938-5094.023438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.218 ± 0.023 mas (9.7 standard errors), is not used. Radius 8.0311 +/- 0.3344 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212667967 (K2 campaign 6): PARAM radius (solar radii) 8.031089 (16th-84th percentiles 7.708072-8.376871), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9748 +/- 0.0971 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212667967 (K2 campaign 6): PARAM mass (solar masses) 0.974811 (16th-84th percentiles 0.883918-1.078168), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,980 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212667967: APOGEE DR17 effective temperature 4979.8667 +/- 50 K (the catalogue's final uncertainty). log g 2.62 from the mass and radius.

**Color.** A Planck spectrum at 4,980 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,980 K and log g 2.62 (u1 0.632, u2 0.145): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
