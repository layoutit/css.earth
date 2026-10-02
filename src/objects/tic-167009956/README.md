# TIC 167009956

## Sources

Its oscillations, recorded by TESS, give 0.93 solar masses and 22.2 solar radii; APOGEE spectra give 4,276 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5283282873330112128, distance 1,421 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 167009956 (observed by TESS): PARAM asteroseismic distance (pc) 1420.859375 (16th-84th percentiles 1389.21875-1459.492188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.673 ± 0.010 mas (66.8 standard errors), is not used. Radius 22.1579 +/- 0.9395 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 167009956 (observed by TESS): PARAM radius (solar radii) 22.157925 (16th-84th percentiles 21.36969-23.248663), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.927 +/- 0.1003 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 167009956 (observed by TESS): PARAM mass (solar masses) 0.927007 (16th-84th percentiles 0.846317-1.046841), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,276 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 167009956: APOGEE DR17 effective temperature 4276.3506 +/- 50 K (the catalogue's final uncertainty). log g 1.71 from the mass and radius.

**Color.** A Planck spectrum at 4,276 K, because pARAM fits an extinction A_V = 0.15 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffd9b2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,276 K and log g 1.71 (u1 0.844, u2 -0.018): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
