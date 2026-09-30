# EPIC 248918047

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.84 solar masses and 8.6 solar radii; APOGEE spectra give 4,718 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3885559537192733056, distance 1,435 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248918047 (K2 campaign 14): PARAM asteroseismic distance (pc) 1434.921875 (16th-84th percentiles 1408.75-1465.859375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.620 ± 0.014 mas (44.2 standard errors), is not used. Radius 8.5791 +/- 0.2366 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248918047 (K2 campaign 14): PARAM radius (solar radii) 8.579058 (16th-84th percentiles 8.382514-8.855721), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8374 +/- 0.0533 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248918047 (K2 campaign 14): PARAM mass (solar masses) 0.837434 (16th-84th percentiles 0.796128-0.902632), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,718 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248918047: APOGEE DR17 effective temperature 4717.99 +/- 50 K (the catalogue's final uncertainty). log g 2.49 from the mass and radius.

**Colour.** A Planck spectrum at 4,718 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,718 K and log g 2.49 (u1 0.709, u2 0.089): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
