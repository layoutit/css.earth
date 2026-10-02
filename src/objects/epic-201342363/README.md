# EPIC 201342363

## Sources

Its oscillations, recorded in K2 campaign 1, give 1.00 solar masses and 10.1 solar radii; APOGEE spectra give 4,887 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3602266556661634048, distance 4,249 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201342363 (K2 campaign 1): PARAM asteroseismic distance (pc) 4249.140625 (16th-84th percentiles 4176.171875-4316.71875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.181 ± 0.016 mas (11.3 standard errors), is not used. Radius 10.1428 +/- 0.2494 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201342363 (K2 campaign 1): PARAM radius (solar radii) 10.142806 (16th-84th percentiles 9.868437-10.367263), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9975 +/- 0.0705 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201342363 (K2 campaign 1): PARAM mass (solar masses) 0.997477 (16th-84th percentiles 0.932327-1.073303), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,887 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201342363: APOGEE DR17 effective temperature 4886.51 +/- 50 K (the catalogue's final uncertainty). log g 2.42 from the mass and radius.

**Color.** A Planck spectrum at 4,887 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,887 K and log g 2.42 (u1 0.657, u2 0.127): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
