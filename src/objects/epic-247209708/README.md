# EPIC 247209708

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.00 solar masses and 9.1 solar radii; GALAH spectra give 4,644 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3410604671869711488, distance 2,270 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247209708 (K2 campaign 13): PARAM asteroseismic distance (pc) 2269.882812 (16th-84th percentiles 2197.910156-2339.667969), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.408 ± 0.021 mas (19.3 standard errors), is not used. Radius 9.1286 +/- 0.4339 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247209708 (K2 campaign 13): PARAM radius (solar radii) 9.128611 (16th-84th percentiles 8.750565-9.618445), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0048 +/- 0.1162 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247209708 (K2 campaign 13): PARAM mass (solar masses) 1.004763 (16th-84th percentiles 0.905056-1.137402), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,644 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247209708: GALAH DR3 effective temperature 4643.8374 +/- 139 K (the catalogue's final uncertainty). log g 2.52 from the mass and radius.

**Colour.** A Planck spectrum at 4,644 K, because pARAM fits an extinction A_V = 1.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,644 K and log g 2.52 (u1 0.733, u2 0.069): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
