# EPIC 201503867

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.04 solar masses and 8.2 solar radii; APOGEE spectra give 4,677 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3699096903587499776, distance 4,745 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201503867 (K2 campaign 10): PARAM asteroseismic distance (pc) 4745.273438 (16th-84th percentiles 4568.164062-4931.054688), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.170 ± 0.033 mas (5.2 standard errors), is not used. Radius 8.2399 +/- 0.3579 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201503867 (K2 campaign 10): PARAM radius (solar radii) 8.239879 (16th-84th percentiles 7.900884-8.616625), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0418 +/- 0.1103 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201503867 (K2 campaign 10): PARAM mass (solar masses) 1.041795 (16th-84th percentiles 0.939998-1.160689), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,677 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201503867: APOGEE DR17 effective temperature 4677.0464 +/- 50 K (the catalogue's final uncertainty). log g 2.62 from the mass and radius.

**Colour.** A Planck spectrum at 4,677 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,677 K and log g 2.62 (u1 0.724, u2 0.076): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
