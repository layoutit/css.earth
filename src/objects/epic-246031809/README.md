# EPIC 246031809

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.94 solar masses and 12.0 solar radii; APOGEE spectra give 4,989 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2438816678462221312, distance 3,459 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246031809 (K2 campaign 12): PARAM asteroseismic distance (pc) 3458.554688 (16th-84th percentiles 3327.65625-3596.210938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.282 ± 0.018 mas (16.1 standard errors), is not used. Radius 11.982 +/- 0.6397 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246031809 (K2 campaign 12): PARAM radius (solar radii) 11.982024 (16th-84th percentiles 11.367043-12.646353), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9419 +/- 0.1184 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246031809 (K2 campaign 12): PARAM mass (solar masses) 0.941908 (16th-84th percentiles 0.831798-1.068667), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,989 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246031809: APOGEE DR17 effective temperature 4989.314 +/- 50 K (the catalogue's final uncertainty). log g 2.26 from the mass and radius.

**Colour.** A Planck spectrum at 4,989 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,989 K and log g 2.26 (u1 0.625, u2 0.150): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
