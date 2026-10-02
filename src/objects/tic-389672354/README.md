# TIC 389672354

## Sources

Its oscillations, recorded by TESS, give 1.09 solar masses and 10.5 solar radii; APOGEE spectra give 4,854 K at its surface. It is also HD 270141. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4659300403828091264, distance 1,058 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 389672354 (observed by TESS): PARAM asteroseismic distance (pc) 1058.212891 (16th-84th percentiles 1049.755859-1066.992188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.923 ± 0.012 mas (80.0 standard errors), is not used. Radius 10.5485 +/- 0.2579 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 389672354 (observed by TESS): PARAM radius (solar radii) 10.548501 (16th-84th percentiles 10.416284-10.932006), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0941 +/- 0.0743 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 389672354 (observed by TESS): PARAM mass (solar masses) 1.094054 (16th-84th percentiles 1.050856-1.199409), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,854 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 389672354: APOGEE DR17 effective temperature 4853.862 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Color.** A Planck spectrum at 4,854 K, because pARAM fits an extinction A_V = 0.25 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,854 K and log g 2.43 (u1 0.667, u2 0.120): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
