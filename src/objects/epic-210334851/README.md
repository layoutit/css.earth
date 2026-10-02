# EPIC 210334851

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.36 solar masses and 6.6 solar radii; APOGEE spectra give 5,093 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3304825399806222336, distance 1,892 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210334851 (K2 campaign 4): PARAM asteroseismic distance (pc) 1891.523438 (16th-84th percentiles 1838.984375-1945.46875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.476 ± 0.016 mas (30.4 standard errors), is not used. Radius 6.5914 +/- 0.2384 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210334851 (K2 campaign 4): PARAM radius (solar radii) 6.59138 (16th-84th percentiles 6.35792-6.834774), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.3572 +/- 0.1143 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210334851 (K2 campaign 4): PARAM mass (solar masses) 1.357199 (16th-84th percentiles 1.247185-1.47585), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,093 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210334851: APOGEE DR17 effective temperature 5093.3984 +/- 50 K (the catalogue's final uncertainty). log g 2.93 from the mass and radius.

**Color.** A Planck spectrum at 5,093 K, because pARAM fits an extinction A_V = 0.61 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,093 K and log g 2.93 (u1 0.604, u2 0.165): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
