# EPIC 213763590

## Sources

Its oscillations, recorded in K2 campaign 7, give 1.42 solar masses and 10.8 solar radii; GALAH spectra give 4,803 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6765551682891070336, distance 4,658 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 213763590 (K2 campaign 7): PARAM asteroseismic distance (pc) 4657.5 (16th-84th percentiles 4600.15625-4715.234375), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.190 ± 0.022 mas (8.6 standard errors), is not used. Radius 10.7675 +/- 0.5752 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 213763590 (K2 campaign 7): PARAM radius (solar radii) 10.767467 (16th-84th percentiles 9.82817-10.978562), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4166 +/- 0.1608 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 213763590 (K2 campaign 7): PARAM mass (solar masses) 1.416629 (16th-84th percentiles 1.162272-1.48382), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,803 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 213763590: GALAH DR3 effective temperature 4803.093 +/- 176 K (the catalogue's final uncertainty). log g 2.53 from the mass and radius.

**Colour.** A Planck spectrum at 4,803 K, because pARAM fits an extinction A_V = 0.22 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,803 K and log g 2.53 (u1 0.683, u2 0.108): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
