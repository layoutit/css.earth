# EPIC 251350334

## Sources

Its oscillations, recorded in K2 campaign 16, give 1.20 solar masses and 9.0 solar radii; APOGEE spectra give 4,757 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 637154000315105024, distance 3,431 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251350334 (K2 campaign 16): PARAM asteroseismic distance (pc) 3430.507812 (16th-84th percentiles 3318.945312-3543.984375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.270 ± 0.025 mas (10.7 standard errors), is not used. Radius 8.9914 +/- 0.3789 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251350334 (K2 campaign 16): PARAM radius (solar radii) 8.991383 (16th-84th percentiles 8.622232-9.380021), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2035 +/- 0.1188 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251350334 (K2 campaign 16): PARAM mass (solar masses) 1.203507 (16th-84th percentiles 1.090011-1.32757), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,757 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251350334: APOGEE DR17 effective temperature 4757.115 +/- 50 K (the catalogue's final uncertainty). log g 2.61 from the mass and radius.

**Colour.** A Planck spectrum at 4,757 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,757 K and log g 2.61 (u1 0.698, u2 0.096): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
