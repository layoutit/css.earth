# EPIC 248778785

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.91 solar masses and 10.0 solar radii; APOGEE spectra give 4,701 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3870315804906073472, distance 3,212 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248778785 (K2 campaign 14): PARAM asteroseismic distance (pc) 3211.484375 (16th-84th percentiles 3102.851562-3345.3125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.256 ± 0.017 mas (14.8 standard errors), is not used. Radius 9.9843 +/- 0.4456 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248778785 (K2 campaign 14): PARAM radius (solar radii) 9.984332 (16th-84th percentiles 9.599335-10.490546), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.912 +/- 0.1007 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248778785 (K2 campaign 14): PARAM mass (solar masses) 0.911956 (16th-84th percentiles 0.829651-1.030984), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,701 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248778785: APOGEE DR17 effective temperature 4701.239000000001 +/- 50 K (the catalogue's final uncertainty). log g 2.4 from the mass and radius.

**Colour.** A Planck spectrum at 4,701 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,701 K and log g 2.4 (u1 0.713, u2 0.085): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
