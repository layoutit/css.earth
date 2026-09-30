# TIC 261154892

## Sources

Its oscillations, recorded by TESS, give 0.98 solar masses and 10.9 solar radii; APOGEE spectra give 4,801 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4623618644463488128, distance 1,005 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 261154892 (observed by TESS): PARAM asteroseismic distance (pc) 1005.322266 (16th-84th percentiles 994.296875-1017.207031), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.938 ± 0.009 mas (107.4 standard errors), is not used. Radius 10.9229 +/- 0.206 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 261154892 (observed by TESS): PARAM radius (solar radii) 10.922879 (16th-84th percentiles 10.750088-11.162125), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9765 +/- 0.0528 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 261154892 (observed by TESS): PARAM mass (solar masses) 0.976482 (16th-84th percentiles 0.932515-1.038155), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,801 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 261154892: APOGEE DR17 effective temperature 4801.1396 +/- 50 K (the catalogue's final uncertainty). log g 2.35 from the mass and radius.

**Colour.** A Planck spectrum at 4,801 K, because pARAM fits an extinction A_V = 0.49 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,801 K and log g 2.35 (u1 0.682, u2 0.109): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
