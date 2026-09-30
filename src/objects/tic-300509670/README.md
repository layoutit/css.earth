# TIC 300509670

## Sources

Its oscillations, recorded by TESS, give 0.94 solar masses and 14.9 solar radii; APOGEE spectra give 4,341 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5264441165323001088, distance 1,117 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 300509670 (observed by TESS): PARAM asteroseismic distance (pc) 1117.089844 (16th-84th percentiles 1097.617188-1138.017578), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.833 ± 0.011 mas (78.1 standard errors), is not used. Radius 14.861 +/- 0.397 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 300509670 (observed by TESS): PARAM radius (solar radii) 14.860965 (16th-84th percentiles 14.516304-15.310305), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9371 +/- 0.071 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 300509670 (observed by TESS): PARAM mass (solar masses) 0.937121 (16th-84th percentiles 0.877131-1.019118), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,341 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 300509670: APOGEE DR17 effective temperature 4340.5615 +/- 50 K (the catalogue's final uncertainty). log g 2.07 from the mass and radius.

**Colour.** A Planck spectrum at 4,341 K, because pARAM fits an extinction A_V = 0.47 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdab5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,341 K and log g 2.07 (u1 0.825, u2 -0.003): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
