# EPIC 212485053

## Sources

Its oscillations, recorded in K2 campaign 17, give 1.28 solar masses and 11.4 solar radii; APOGEE spectra give 5,265 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3609280719291888768, distance 3,915 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212485053 (K2 campaign 17): PARAM asteroseismic distance (pc) 3915 (16th-84th percentiles 3694.0625-4010.351562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.342 ± 0.018 mas (18.6 standard errors), is not used. Radius 11.3696 +/- 0.6089 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212485053 (K2 campaign 17): PARAM radius (solar radii) 11.369639 (16th-84th percentiles 10.717681-11.935438), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2825 +/- 0.161 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212485053 (K2 campaign 17): PARAM mass (solar masses) 1.282545 (16th-84th percentiles 1.114043-1.436063), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,265 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212485053: APOGEE DR17 effective temperature 5265.377 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 5,265 K, because pARAM fits an extinction A_V = -0.02 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffead9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,265 K and log g 2.43 (u1 0.554, u2 0.199): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
