# EPIC 211964709

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.09 solar masses and 10.4 solar radii; GALAH spectra give 5,178 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 660594561723383552, distance 2,647 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211964709 (K2 campaign 5): PARAM asteroseismic distance (pc) 2647.148438 (16th-84th percentiles 2606.367188-2688.242188), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.392 ± 0.015 mas (25.9 standard errors), is not used. Radius 10.4001 +/- 0.3025 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211964709 (K2 campaign 5): PARAM radius (solar radii) 10.400143 (16th-84th percentiles 10.117025-10.721992), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.092 +/- 0.0927 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211964709 (K2 campaign 5): PARAM mass (solar masses) 1.092003 (16th-84th percentiles 0.999096-1.184483), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,178 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211964709: GALAH DR3 effective temperature 5178.1665 +/- 140 K (the catalogue's final uncertainty). log g 2.44 from the mass and radius.

**Colour.** A Planck spectrum at 5,178 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe9d6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,178 K and log g 2.44 (u1 0.577, u2 0.183): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
