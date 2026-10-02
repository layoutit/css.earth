# TIC 31306938

## Sources

Its oscillations, recorded by TESS, give 2.04 solar masses and 16.6 solar radii; APOGEE spectra give 4,761 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4659200313915082880, distance 1,324 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 31306938 (observed by TESS): PARAM asteroseismic distance (pc) 1324.179688 (16th-84th percentiles 1295.058594-1362.285156), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 1.076 ± 0.012 mas (89.4 standard errors), is not used. Radius 16.5714 +/- 0.5652 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 31306938 (observed by TESS): PARAM radius (solar radii) 16.571421 (16th-84th percentiles 16.045187-17.175567), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.0374 +/- 0.1758 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 31306938 (observed by TESS): PARAM mass (solar masses) 2.037429 (16th-84th percentiles 1.869472-2.221158), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,761 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 31306938: APOGEE DR17 effective temperature 4761.096 +/- 50 K (the catalogue's final uncertainty). log g 2.31 from the mass and radius.

**Color.** A Planck spectrum at 4,761 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,761 K and log g 2.31 (u1 0.693, u2 0.101): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
