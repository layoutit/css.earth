# EPIC 247343317

## Sources

Its oscillations, recorded in K2 campaign 13, give 0.90 solar masses and 9.8 solar radii; GALAH spectra give 4,920 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3411728437176533760, distance 2,961 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247343317 (K2 campaign 13): PARAM asteroseismic distance (pc) 2960.859375 (16th-84th percentiles 2880.507812-3047.460938), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.322 ± 0.018 mas (17.8 standard errors), is not used. Radius 9.7844 +/- 0.3148 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247343317 (K2 campaign 13): PARAM radius (solar radii) 9.784419 (16th-84th percentiles 9.472049-10.101566), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8981 +/- 0.068 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247343317 (K2 campaign 13): PARAM mass (solar masses) 0.89807 (16th-84th percentiles 0.829913-0.96596), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,920 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247343317: GALAH DR3 effective temperature 4919.9106 +/- 120 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Color.** A Planck spectrum at 4,920 K, because pARAM fits an extinction A_V = 0.98 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the color routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,920 K and log g 2.41 (u1 0.647, u2 0.134): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
