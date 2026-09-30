# EPIC 220647440

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.89 solar masses and 7.6 solar radii; GALAH spectra give 5,166 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2580053787477560576, distance 1,934 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 220647440 (K2 campaign 8): PARAM asteroseismic distance (pc) 1933.671875 (16th-84th percentiles 1860.800781-2007.421875), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.510 ± 0.016 mas (31.9 standard errors), is not used. Radius 7.6449 +/- 0.3279 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 220647440 (K2 campaign 8): PARAM radius (solar radii) 7.644897 (16th-84th percentiles 7.325691-7.981456), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8869 +/- 0.0937 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 220647440 (K2 campaign 8): PARAM mass (solar masses) 0.886868 (16th-84th percentiles 0.798581-0.985998), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,166 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 220647440: GALAH DR3 effective temperature 5166.1606 +/- 108 K (the catalogue's final uncertainty). log g 2.62 from the mass and radius.

**Colour.** A Planck spectrum at 5,166 K, because pARAM fits an extinction A_V = -0.02 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe9d6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,166 K and log g 2.62 (u1 0.581, u2 0.181): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
