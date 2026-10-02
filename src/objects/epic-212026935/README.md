# EPIC 212026935

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.04 solar masses and 8.2 solar radii; APOGEE spectra give 4,660 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 675867912104993664, distance 1,894 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212026935 (K2 campaign 5): PARAM asteroseismic distance (pc) 1893.964844 (16th-84th percentiles 1835.800781-1964.511719), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.517 ± 0.019 mas (27.7 standard errors), is not used. Radius 8.1671 +/- 0.3255 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212026935 (K2 campaign 5): PARAM radius (solar radii) 8.167095 (16th-84th percentiles 7.871527-8.522607), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0414 +/- 0.1029 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212026935 (K2 campaign 5): PARAM mass (solar masses) 1.041392 (16th-84th percentiles 0.952817-1.158708), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,660 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212026935: APOGEE DR17 effective temperature 4659.68 +/- 50 K (the catalogue's final uncertainty). log g 2.63 from the mass and radius.

**Color.** A Planck spectrum at 4,660 K, because pARAM fits an extinction A_V = 0.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,660 K and log g 2.63 (u1 0.730, u2 0.071): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
