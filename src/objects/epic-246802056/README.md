# EPIC 246802056

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.87 solar masses and 19.7 solar radii; APOGEE spectra give 4,545 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3393287496875209856, distance 1,366 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246802056 (K2 campaign 13): PARAM asteroseismic distance (pc) 1366.015625 (16th-84th percentiles 1288.046875-1419.589844), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.725 ± 0.042 mas (17.2 standard errors), is not used. Radius 19.7139 +/- 1.1629 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246802056 (K2 campaign 13): PARAM radius (solar radii) 19.713882 (16th-84th percentiles 18.372046-20.697793), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.8656 +/- 0.2341 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246802056 (K2 campaign 13): PARAM mass (solar masses) 1.865555 (16th-84th percentiles 1.600206-2.068307), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,545 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246802056: APOGEE DR17 effective temperature 4545.136 +/- 50 K (the catalogue's final uncertainty). log g 2.12 from the mass and radius.

**Color.** A Planck spectrum at 4,545 K, because pARAM fits an extinction A_V = 1.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebe. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,545 K and log g 2.12 (u1 0.759, u2 0.051): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
