# EPIC 212576546

## Sources

Its oscillations, recorded in K2 campaign 6, give 1.50 solar masses and 14.7 solar radii; APOGEE spectra give 5,154 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3613880697985274112, distance 6,330 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212576546 (K2 campaign 6): PARAM asteroseismic distance (pc) 6329.921875 (16th-84th percentiles 6085.46875-6579.53125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.160 ± 0.021 mas (7.8 standard errors), is not used. Radius 14.7316 +/- 0.8083 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212576546 (K2 campaign 6): PARAM radius (solar radii) 14.731585 (16th-84th percentiles 13.944493-15.561024), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4953 +/- 0.1866 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212576546 (K2 campaign 6): PARAM mass (solar masses) 1.495335 (16th-84th percentiles 1.31934-1.692538), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,154 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212576546: APOGEE DR17 effective temperature 5154.340999999999 +/- 50 K (the catalogue's final uncertainty). log g 2.28 from the mass and radius.

**Color.** A Planck spectrum at 5,154 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,154 K and log g 2.28 (u1 0.582, u2 0.179): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
