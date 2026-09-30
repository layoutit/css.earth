# TIC 350953603

## Sources

Its oscillations, recorded by TESS, give 1.23 solar masses and 10.8 solar radii; APOGEE spectra give 4,683 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5498928237744337920, distance 1,088 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 350953603 (observed by TESS): PARAM asteroseismic distance (pc) 1088.046875 (16th-84th percentiles 1078.105469-1097.802734), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.888 ± 0.010 mas (89.8 standard errors), is not used. Radius 10.8428 +/- 0.1543 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 350953603 (observed by TESS): PARAM radius (solar radii) 10.842842 (16th-84th percentiles 10.659019-10.967586), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2255 +/- 0.0535 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 350953603 (observed by TESS): PARAM mass (solar masses) 1.225455 (16th-84th percentiles 1.163144-1.270215), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,683 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 350953603: APOGEE DR17 effective temperature 4683.1904 +/- 50 K (the catalogue's final uncertainty). log g 2.46 from the mass and radius.

**Colour.** A Planck spectrum at 4,683 K, because pARAM fits an extinction A_V = 0.22 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,683 K and log g 2.46 (u1 0.720, u2 0.080): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
