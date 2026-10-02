# TIC 25132064

## Sources

Its oscillations, recorded by TESS, give 0.81 solar masses and 14.9 solar radii; APOGEE spectra give 4,459 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4668326058558248320, distance 1,352 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 25132064 (observed by TESS): PARAM asteroseismic distance (pc) 1351.953125 (16th-84th percentiles 1340.429688-1364.511719), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.647 ± 0.010 mas (66.8 standard errors), is not used. Radius 14.8733 +/- 0.192 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 25132064 (observed by TESS): PARAM radius (solar radii) 14.873338 (16th-84th percentiles 14.733377-15.117346), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8146 +/- 0.0294 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 25132064 (observed by TESS): PARAM mass (solar masses) 0.814625 (16th-84th percentiles 0.794169-0.853058), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,459 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 25132064: APOGEE DR17 effective temperature 4459.1187 +/- 50 K (the catalogue's final uncertainty). log g 2 from the mass and radius.

**Color.** A Planck spectrum at 4,459 K, because pARAM fits an extinction A_V = 0.18 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddba. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,459 K and log g 2 (u1 0.784, u2 0.031): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
