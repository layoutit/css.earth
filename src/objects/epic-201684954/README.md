# EPIC 201684954

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.86 solar masses and 15.6 solar radii; APOGEE spectra give 4,299 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3814761777321746176, distance 3,640 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201684954 (K2 campaign 14): PARAM asteroseismic distance (pc) 3639.765625 (16th-84th percentiles 3582.382812-3704.960938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.220 ± 0.015 mas (14.2 standard errors), is not used. Radius 15.6432 +/- 0.3756 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201684954 (K2 campaign 14): PARAM radius (solar radii) 15.643233 (16th-84th percentiles 15.329296-16.080487), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8642 +/- 0.0397 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201684954 (K2 campaign 14): PARAM mass (solar masses) 0.864152 (16th-84th percentiles 0.837687-0.917064), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,299 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201684954: APOGEE DR17 effective temperature 4298.557 +/- 50 K (the catalogue's final uncertainty). log g 1.99 from the mass and radius.

**Color.** A Planck spectrum at 4,299 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdab3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,299 K and log g 1.99 (u1 0.838, u2 -0.013): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
