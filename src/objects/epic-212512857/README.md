# EPIC 212512857

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.87 solar masses and 7.5 solar radii; APOGEE spectra give 4,833 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3621742481001744128, distance 3,017 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212512857 (K2 campaign 6): PARAM asteroseismic distance (pc) 3017.382812 (16th-84th percentiles 2940.703125-3103.320312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.296 ± 0.018 mas (16.8 standard errors), is not used. Radius 7.5033 +/- 0.2456 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212512857 (K2 campaign 6): PARAM radius (solar radii) 7.503314 (16th-84th percentiles 7.282095-7.773327), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8693 +/- 0.0696 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212512857 (K2 campaign 6): PARAM mass (solar masses) 0.869336 (16th-84th percentiles 0.808021-0.94726), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,833 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212512857: APOGEE DR17 effective temperature 4833.219 +/- 50 K (the catalogue's final uncertainty). log g 2.63 from the mass and radius.

**Colour.** A Planck spectrum at 4,833 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,833 K and log g 2.63 (u1 0.676, u2 0.113): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
