# EPIC 212376089

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.87 solar masses and 9.0 solar radii; APOGEE spectra give 5,122 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3604974619440543488, distance 3,726 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212376089 (K2 campaign 6): PARAM asteroseismic distance (pc) 3726.445312 (16th-84th percentiles 3610-3851.484375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.260 ± 0.018 mas (14.3 standard errors), is not used. Radius 8.9778 +/- 0.4089 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212376089 (K2 campaign 6): PARAM radius (solar radii) 8.977809 (16th-84th percentiles 8.613305-9.431101), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.871 +/- 0.095 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212376089 (K2 campaign 6): PARAM mass (solar masses) 0.870983 (16th-84th percentiles 0.788528-0.978557), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,122 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212376089: APOGEE DR17 effective temperature 5122.116 +/- 51 K (the catalogue's final uncertainty). log g 2.47 from the mass and radius.

**Color.** A Planck spectrum at 5,122 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,122 K and log g 2.47 (u1 0.592, u2 0.173): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
