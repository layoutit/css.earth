# EPIC 211302061

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.93 solar masses and 6.9 solar radii; APOGEE spectra give 4,711 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 597733282939848192, distance 1,340 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211302061 (K2 campaign 5): PARAM asteroseismic distance (pc) 1340.117188 (16th-84th percentiles 1303.085938-1379.277344), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.617 ± 0.030 mas (20.6 standard errors), is not used. Radius 6.9311 +/- 0.2345 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211302061 (K2 campaign 5): PARAM radius (solar radii) 6.931078 (16th-84th percentiles 6.711974-7.180936), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9328 +/- 0.0776 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211302061 (K2 campaign 5): PARAM mass (solar masses) 0.93285 (16th-84th percentiles 0.862019-1.017143), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,711 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211302061: APOGEE DR17 effective temperature 4710.594 +/- 50 K (the catalogue's final uncertainty). log g 2.73 from the mass and radius.

**Colour.** A Planck spectrum at 4,711 K, because pARAM fits an extinction A_V = -0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,711 K and log g 2.73 (u1 0.715, u2 0.083): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
