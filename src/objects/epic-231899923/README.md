# EPIC 231899923

## Sources

Its oscillations, recorded in K2 campaign 11, give 1.25 solar masses and 10.7 solar radii; APOGEE spectra give 4,661 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6030169920796837760, distance 2,049 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 231899923 (K2 campaign 11): PARAM asteroseismic distance (pc) 2049.160156 (16th-84th percentiles 2028.28125-2071.054688), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.524 ± 0.016 mas (31.9 standard errors), is not used. Radius 10.7146 +/- 0.1682 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 231899923 (K2 campaign 11): PARAM radius (solar radii) 10.714625 (16th-84th percentiles 10.540582-10.877019), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2458 +/- 0.0711 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 231899923 (K2 campaign 11): PARAM mass (solar masses) 1.245777 (16th-84th percentiles 1.162956-1.305252), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,661 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 231899923: APOGEE DR17 effective temperature 4660.9966 +/- 50 K (the catalogue's final uncertainty). log g 2.47 from the mass and radius.

**Color.** A Planck spectrum at 4,661 K, because pARAM fits an extinction A_V = 0.64 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,661 K and log g 2.47 (u1 0.727, u2 0.074): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
