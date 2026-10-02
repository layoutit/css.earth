# EPIC 210363526

## Sources

Its oscillations, recorded in K2 campaign 4, give 0.93 solar masses and 7.7 solar radii; APOGEE spectra give 5,053 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 37631236434456576, distance 1,825 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210363526 (K2 campaign 4): PARAM asteroseismic distance (pc) 1825.058594 (16th-84th percentiles 1772.5-1880.371094), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.543 ± 0.017 mas (32.5 standard errors), is not used. Radius 7.6917 +/- 0.2984 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210363526 (K2 campaign 4): PARAM radius (solar radii) 7.691659 (16th-84th percentiles 7.403147-7.999879), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9283 +/- 0.0884 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210363526 (K2 campaign 4): PARAM mass (solar masses) 0.928296 (16th-84th percentiles 0.845743-1.022522), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,053 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210363526: APOGEE DR17 effective temperature 5052.8286 +/- 50 K (the catalogue's final uncertainty). log g 2.63 from the mass and radius.

**Color.** A Planck spectrum at 5,053 K, because pARAM fits an extinction A_V = 0.87 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,053 K and log g 2.63 (u1 0.612, u2 0.159): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
