# TIC 32035214

## Sources

Its oscillations, recorded by TESS, give 1.43 solar masses and 11.0 solar radii; APOGEE spectra give 4,742 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4642010965734761088, distance 1,115 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 32035214 (observed by TESS): PARAM asteroseismic distance (pc) 1114.736328 (16th-84th percentiles 1101.572266-1128.320312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.904 ± 0.011 mas (85.5 standard errors), is not used. Radius 11.0117 +/- 0.3687 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 32035214 (observed by TESS): PARAM radius (solar radii) 11.011749 (16th-84th percentiles 10.83232-11.569794), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4315 +/- 0.1189 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 32035214 (observed by TESS): PARAM mass (solar masses) 1.43149 (16th-84th percentiles 1.381682-1.619506), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,742 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 32035214: APOGEE DR17 effective temperature 4741.742 +/- 50 K (the catalogue's final uncertainty). log g 2.51 from the mass and radius.

**Color.** A Planck spectrum at 4,742 K, because pARAM fits an extinction A_V = 0.19 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,742 K and log g 2.51 (u1 0.701, u2 0.094): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
