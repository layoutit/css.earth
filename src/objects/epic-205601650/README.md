# EPIC 205601650

## Sources

Its oscillations, recorded in K2 campaign 2, give 0.93 solar masses and 9.3 solar radii; GALAH spectra give 4,627 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4325036155880952960, distance 1,351 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205601650 (K2 campaign 2): PARAM asteroseismic distance (pc) 1351.074219 (16th-84th percentiles 1310.507812-1393.652344), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.665 ± 0.018 mas (37.1 standard errors), is not used. Radius 9.3379 +/- 0.4603 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205601650 (K2 campaign 2): PARAM radius (solar radii) 9.337871 (16th-84th percentiles 8.973643-9.894219), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9251 +/- 0.1091 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205601650 (K2 campaign 2): PARAM mass (solar masses) 0.925088 (16th-84th percentiles 0.841384-1.059503), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,627 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205601650: GALAH DR3 effective temperature 4627.1333 +/- 118 K (the catalogue's final uncertainty). log g 2.46 from the mass and radius.

**Colour.** A Planck spectrum at 4,627 K, because pARAM fits an extinction A_V = 1.19 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,627 K and log g 2.46 (u1 0.738, u2 0.066): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
