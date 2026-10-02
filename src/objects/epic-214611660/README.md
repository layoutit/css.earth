# EPIC 214611660

## Sources

Its oscillations, recorded in K2 campaign 7, give 1.25 solar masses and 12.1 solar radii; GALAH spectra give 4,739 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4073171787548779648, distance 3,584 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 214611660 (K2 campaign 7): PARAM asteroseismic distance (pc) 3584.179688 (16th-84th percentiles 3368.242188-3837.265625), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.339 ± 0.019 mas (17.6 standard errors), is not used. Radius 12.101 +/- 0.8041 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 214611660 (K2 campaign 7): PARAM radius (solar radii) 12.101026 (16th-84th percentiles 11.349583-12.957755), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2522 +/- 0.1888 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 214611660 (K2 campaign 7): PARAM mass (solar masses) 1.252199 (16th-84th percentiles 1.082985-1.460595), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,739 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 214611660: GALAH DR3 effective temperature 4738.899 +/- 109 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Color.** A Planck spectrum at 4,739 K, because pARAM fits an extinction A_V = 0.88 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the color routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,739 K and log g 2.37 (u1 0.701, u2 0.095): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
