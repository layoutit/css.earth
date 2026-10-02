# EPIC 212356810

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.93 solar masses and 7.8 solar radii; APOGEE spectra give 4,575 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3604921774162907520, distance 2,628 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212356810 (K2 campaign 6): PARAM asteroseismic distance (pc) 2627.851562 (16th-84th percentiles 2571.757812-2689.492188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.333 ± 0.019 mas (17.8 standard errors), is not used. Radius 7.8482 +/- 0.2245 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212356810 (K2 campaign 6): PARAM radius (solar radii) 7.848196 (16th-84th percentiles 7.641566-8.090519), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9317 +/- 0.0623 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212356810 (K2 campaign 6): PARAM mass (solar masses) 0.931749 (16th-84th percentiles 0.876237-1.000832), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,575 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212356810: APOGEE DR17 effective temperature 4575.3936 +/- 50 K (the catalogue's final uncertainty). log g 2.62 from the mass and radius.

**Color.** A Planck spectrum at 4,575 K, because pARAM fits an extinction A_V = 0.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,575 K and log g 2.62 (u1 0.757, u2 0.050): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
