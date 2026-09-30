# EPIC 210389274

## Sources

Its oscillations, recorded in K2 campaign 4, give 0.89 solar masses and 14.9 solar radii; APOGEE spectra give 4,367 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 38456213752746624, distance 1,802 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210389274 (K2 campaign 4): PARAM asteroseismic distance (pc) 1802.441406 (16th-84th percentiles 1768.261719-1847.03125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.512 ± 0.014 mas (36.0 standard errors), is not used. Radius 14.9134 +/- 0.5267 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210389274 (K2 campaign 4): PARAM radius (solar radii) 14.913447 (16th-84th percentiles 14.50864-15.562135), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8933 +/- 0.0689 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210389274 (K2 campaign 4): PARAM mass (solar masses) 0.893332 (16th-84th percentiles 0.844897-0.98278), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,367 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210389274: APOGEE DR17 effective temperature 4367.4663 +/- 50 K (the catalogue's final uncertainty). log g 2.04 from the mass and radius.

**Colour.** A Planck spectrum at 4,367 K, because pARAM fits an extinction A_V = 0.84 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdbb6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,367 K and log g 2.04 (u1 0.816, u2 0.005): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
