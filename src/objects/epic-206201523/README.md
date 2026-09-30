# EPIC 206201523

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.82 solar masses and 11.5 solar radii; APOGEE spectra give 4,556 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2615778539467266176, distance 3,043 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206201523 (K2 campaign 3): PARAM asteroseismic distance (pc) 3043.007812 (16th-84th percentiles 3000.039062-3092.34375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.278 ± 0.019 mas (14.9 standard errors), is not used. Radius 11.5384 +/- 0.2508 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206201523 (K2 campaign 3): PARAM radius (solar radii) 11.538429 (16th-84th percentiles 11.335937-11.837574), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.825 +/- 0.0381 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206201523 (K2 campaign 3): PARAM mass (solar masses) 0.82503 (16th-84th percentiles 0.799424-0.87567), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,556 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206201523: APOGEE DR17 effective temperature 4556.1196 +/- 50 K (the catalogue's final uncertainty). log g 2.23 from the mass and radius.

**Colour.** A Planck spectrum at 4,556 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbe. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,556 K and log g 2.23 (u1 0.757, u2 0.052): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
