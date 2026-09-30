# EPIC 247586633

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.99 solar masses and 20.4 solar radii; APOGEE spectra give 4,733 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3418343687542302592, distance 3,329 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247586633 (K2 campaign 13): PARAM asteroseismic distance (pc) 3329.257812 (16th-84th percentiles 3248.632812-3424.453125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.363 ± 0.016 mas (23.2 standard errors), is not used. Radius 20.4051 +/- 1.145 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247586633 (K2 campaign 13): PARAM radius (solar radii) 20.405113 (16th-84th percentiles 19.500933-21.790901), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.9883 +/- 0.2442 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247586633 (K2 campaign 13): PARAM mass (solar masses) 1.988325 (16th-84th percentiles 1.800026-2.288354), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,733 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247586633: APOGEE DR17 effective temperature 4732.919 +/- 50 K (the catalogue's final uncertainty). log g 2.12 from the mass and radius.

**Colour.** A Planck spectrum at 4,733 K, because pARAM fits an extinction A_V = 1.36 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,733 K and log g 2.12 (u1 0.699, u2 0.096): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
