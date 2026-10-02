# EPIC 212414249

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.96 solar masses and 12.8 solar radii; APOGEE spectra give 4,647 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6301841724843984512, distance 3,298 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212414249 (K2 campaign 6): PARAM asteroseismic distance (pc) 3298.359375 (16th-84th percentiles 3166.171875-3438.632812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.329 ± 0.013 mas (24.9 standard errors), is not used. Radius 12.7823 +/- 0.6638 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212414249 (K2 campaign 6): PARAM radius (solar radii) 12.782303 (16th-84th percentiles 12.163454-13.49111), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9626 +/- 0.1158 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212414249 (K2 campaign 6): PARAM mass (solar masses) 0.962631 (16th-84th percentiles 0.858076-1.089774), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,647 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212414249: APOGEE DR17 effective temperature 4647.1196 +/- 50 K (the catalogue's final uncertainty). log g 2.21 from the mass and radius.

**Color.** A Planck spectrum at 4,647 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,647 K and log g 2.21 (u1 0.728, u2 0.074): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
