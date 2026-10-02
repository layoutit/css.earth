# EPIC 212005960

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.08 solar masses and 7.3 solar radii; APOGEE spectra give 4,691 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 675664742972197888, distance 1,033 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212005960 (K2 campaign 5): PARAM asteroseismic distance (pc) 1033.164062 (16th-84th percentiles 1004.863281-1062.421875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 1.016 ± 0.016 mas (63.9 standard errors), is not used. Radius 7.3393 +/- 0.2561 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212005960 (K2 campaign 5): PARAM radius (solar radii) 7.339254 (16th-84th percentiles 7.088091-7.600241), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0841 +/- 0.0918 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212005960 (K2 campaign 5): PARAM mass (solar masses) 1.084072 (16th-84th percentiles 0.9961-1.179634), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,691 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212005960: APOGEE DR17 effective temperature 4691.236 +/- 50 K (the catalogue's final uncertainty). log g 2.74 from the mass and radius.

**Color.** A Planck spectrum at 4,691 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,691 K and log g 2.74 (u1 0.722, u2 0.077): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
