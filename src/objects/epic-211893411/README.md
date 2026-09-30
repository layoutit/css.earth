# EPIC 211893411

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.11 solar masses and 12.0 solar radii; APOGEE spectra give 4,807 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 659708733309096960, distance 7,589 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211893411 (K2 campaign 5): PARAM asteroseismic distance (pc) 7588.59375 (16th-84th percentiles 7340.3125-7825.859375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.127 ± 0.030 mas (4.2 standard errors), is not used. Radius 12.0477 +/- 0.5566 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211893411 (K2 campaign 5): PARAM radius (solar radii) 12.047699 (16th-84th percentiles 11.462427-12.575554), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1091 +/- 0.1187 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211893411 (K2 campaign 5): PARAM mass (solar masses) 1.109139 (16th-84th percentiles 0.983616-1.220944), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,807 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211893411: APOGEE DR17 effective temperature 4807.1543 +/- 50 K (the catalogue's final uncertainty). log g 2.32 from the mass and radius.

**Colour.** A Planck spectrum at 4,807 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,807 K and log g 2.32 (u1 0.680, u2 0.111): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
