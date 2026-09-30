# EPIC 249429434

## Sources

Its oscillations, recorded in K2 campaign 15, give 1.29 solar masses and 5.1 solar radii; GALAH spectra give 4,969 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6228419873098176256, distance 1,014 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249429434 (K2 campaign 15): PARAM asteroseismic distance (pc) 1014.335938 (16th-84th percentiles 981.845703-1047.792969), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 1.051 ± 0.015 mas (69.4 standard errors), is not used. Radius 5.1299 +/- 0.2083 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249429434 (K2 campaign 15): PARAM radius (solar radii) 5.129862 (16th-84th percentiles 4.92465-5.341264), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2939 +/- 0.1212 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249429434 (K2 campaign 15): PARAM mass (solar masses) 1.293901 (16th-84th percentiles 1.177866-1.420185), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,969 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249429434: GALAH DR3 effective temperature 4969.1626 +/- 131 K (the catalogue's final uncertainty). log g 3.13 from the mass and radius.

**Colour.** A Planck spectrum at 4,969 K, because pARAM fits an extinction A_V = 0.38 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe6ce. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,969 K and log g 3.13 (u1 0.643, u2 0.136): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
