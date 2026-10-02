# EPIC 201428034

## Sources

Its oscillations, recorded in K2 campaign 1, give 1.02 solar masses and 10.9 solar radii; APOGEE spectra give 4,916 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3797159592593892864, distance 3,585 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201428034 (K2 campaign 1): PARAM asteroseismic distance (pc) 3585.3125 (16th-84th percentiles 3493.90625-3675.9375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.268 ± 0.016 mas (16.8 standard errors), is not used. Radius 10.8887 +/- 0.3962 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201428034 (K2 campaign 1): PARAM radius (solar radii) 10.888663 (16th-84th percentiles 10.487802-11.280299), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0186 +/- 0.0994 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201428034 (K2 campaign 1): PARAM mass (solar masses) 1.018633 (16th-84th percentiles 0.926863-1.125761), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,916 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201428034: APOGEE DR17 effective temperature 4916.4644 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Color.** A Planck spectrum at 4,916 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,916 K and log g 2.37 (u1 0.648, u2 0.134): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
