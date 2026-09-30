# EPIC 201425594

## Sources

Its oscillations, recorded in K2 campaign 10, give 2.29 solar masses and 16.2 solar radii; APOGEE spectra give 5,019 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3695168382901355392, distance 7,060 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201425594 (K2 campaign 10): PARAM asteroseismic distance (pc) 7059.6875 (16th-84th percentiles 6812.96875-7274.921875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.201 ± 0.021 mas (9.5 standard errors), is not used. Radius 16.2377 +/- 0.9529 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201425594 (K2 campaign 10): PARAM radius (solar radii) 16.237679 (16th-84th percentiles 15.132836-17.038589), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.2945 +/- 0.2901 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201425594 (K2 campaign 10): PARAM mass (solar masses) 2.294475 (16th-84th percentiles 1.970182-2.550331), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,019 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201425594: APOGEE DR17 effective temperature 5018.8843 +/- 50 K (the catalogue's final uncertainty). log g 2.38 from the mass and radius.

**Colour.** A Planck spectrum at 5,019 K, because pARAM fits an extinction A_V = 0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,019 K and log g 2.38 (u1 0.618, u2 0.155): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
