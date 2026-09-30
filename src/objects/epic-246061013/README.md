# EPIC 246061013

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.89 solar masses and 11.5 solar radii; APOGEE spectra give 4,569 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2436287664279377792, distance 1,788 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246061013 (K2 campaign 12): PARAM asteroseismic distance (pc) 1787.558594 (16th-84th percentiles 1740.332031-1846.230469), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.559 ± 0.015 mas (37.3 standard errors), is not used. Radius 11.5044 +/- 0.4339 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246061013 (K2 campaign 12): PARAM radius (solar radii) 11.504381 (16th-84th percentiles 11.144479-12.012344), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8892 +/- 0.0787 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246061013 (K2 campaign 12): PARAM mass (solar masses) 0.889224 (16th-84th percentiles 0.825875-0.983196), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,569 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246061013: APOGEE DR17 effective temperature 4569.2056 +/- 50 K (the catalogue's final uncertainty). log g 2.27 from the mass and radius.

**Colour.** A Planck spectrum at 4,569 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,569 K and log g 2.27 (u1 0.754, u2 0.054): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
