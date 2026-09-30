# EPIC 248517579

## Sources

Its oscillations, recorded in K2 campaign 14, give 1.26 solar masses and 11.7 solar radii; GALAH spectra give 4,645 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3857158159710368384, distance 2,731 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 248517579 (K2 campaign 14): PARAM asteroseismic distance (pc) 2731.171875 (16th-84th percentiles 2569.296875-2895.9375), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.357 ± 0.016 mas (22.2 standard errors), is not used. Radius 11.6708 +/- 0.7347 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 248517579 (K2 campaign 14): PARAM radius (solar radii) 11.670804 (16th-84th percentiles 10.959398-12.428737), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2621 +/- 0.1851 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 248517579 (K2 campaign 14): PARAM mass (solar masses) 1.262108 (16th-84th percentiles 1.091014-1.46117), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,645 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 248517579: GALAH DR3 effective temperature 4644.9517 +/- 107 K (the catalogue's final uncertainty). log g 2.4 from the mass and radius.

**Colour.** A Planck spectrum at 4,645 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,645 K and log g 2.4 (u1 0.731, u2 0.071): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
