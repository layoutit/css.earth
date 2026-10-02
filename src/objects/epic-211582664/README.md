# EPIC 211582664

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.84 solar masses and 10.1 solar radii; GALAH spectra give 4,741 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 607170008988341248, distance 2,005 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211582664 (K2 campaign 5): PARAM asteroseismic distance (pc) 2004.667969 (16th-84th percentiles 1977.148438-2033.535156), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.486 ± 0.015 mas (33.3 standard errors), is not used. Radius 10.1352 +/- 0.1729 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211582664 (K2 campaign 5): PARAM radius (solar radii) 10.135236 (16th-84th percentiles 9.98646-10.332166), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8373 +/- 0.0274 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211582664 (K2 campaign 5): PARAM mass (solar masses) 0.837334 (16th-84th percentiles 0.817044-0.871792), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,741 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211582664: GALAH DR3 effective temperature 4741.252 +/- 88 K (the catalogue's final uncertainty). log g 2.35 from the mass and radius.

**Color.** A Planck spectrum at 4,741 K, because pARAM fits an extinction A_V = 0.24 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the color routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,741 K and log g 2.35 (u1 0.700, u2 0.096): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
