# EPIC 249181719

## Sources

Its oscillations, recorded in K2 campaign 15, give 1.19 solar masses and 14.0 solar radii; GALAH spectra give 4,649 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6234903388229096960, distance 3,794 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249181719 (K2 campaign 15): PARAM asteroseismic distance (pc) 3794.296875 (16th-84th percentiles 3618.828125-3982.265625), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.247 ± 0.027 mas (9.3 standard errors), is not used. Radius 14.0165 +/- 0.8997 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249181719 (K2 campaign 15): PARAM radius (solar radii) 14.016462 (16th-84th percentiles 13.168626-14.968085), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1879 +/- 0.1765 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249181719 (K2 campaign 15): PARAM mass (solar masses) 1.187854 (16th-84th percentiles 1.028199-1.381116), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,649 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249181719: GALAH DR3 effective temperature 4649.0063 +/- 118 K (the catalogue's final uncertainty). log g 2.22 from the mass and radius.

**Colour.** A Planck spectrum at 4,649 K, because pARAM fits an extinction A_V = 0.84 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,649 K and log g 2.22 (u1 0.727, u2 0.074): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
