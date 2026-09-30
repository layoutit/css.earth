# EPIC 212423667

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.88 solar masses and 10.3 solar radii; APOGEE spectra give 4,656 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3609076588086105728, distance 4,176 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212423667 (K2 campaign 6): PARAM asteroseismic distance (pc) 4176.367188 (16th-84th percentiles 4050.664062-4325.46875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.216 ± 0.022 mas (9.8 standard errors), is not used. Radius 10.2549 +/- 0.4143 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212423667 (K2 campaign 6): PARAM radius (solar radii) 10.254893 (16th-84th percentiles 9.909908-10.738438), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8795 +/- 0.0841 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212423667 (K2 campaign 6): PARAM mass (solar masses) 0.879474 (16th-84th percentiles 0.811866-0.980029), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,656 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212423667: APOGEE DR17 effective temperature 4655.9497 +/- 50 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Colour.** A Planck spectrum at 4,656 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,656 K and log g 2.36 (u1 0.727, u2 0.074): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
