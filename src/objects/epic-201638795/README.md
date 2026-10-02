# EPIC 201638795

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.95 solar masses and 7.4 solar radii; APOGEE spectra give 4,785 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3810876622921113984, distance 3,571 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201638795 (K2 campaign 1): PARAM asteroseismic distance (pc) 3570.9375 (16th-84th percentiles 3461.210938-3685.859375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.273 ± 0.020 mas (13.4 standard errors), is not used. Radius 7.3532 +/- 0.278 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201638795 (K2 campaign 1): PARAM radius (solar radii) 7.35324 (16th-84th percentiles 7.090151-7.646098), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9479 +/- 0.0935 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201638795 (K2 campaign 1): PARAM mass (solar masses) 0.947948 (16th-84th percentiles 0.862024-1.048926), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,785 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201638795: APOGEE DR17 effective temperature 4785.117 +/- 50 K (the catalogue's final uncertainty). log g 2.68 from the mass and radius.

**Color.** A Planck spectrum at 4,785 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,785 K and log g 2.68 (u1 0.691, u2 0.101): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
