# TIC 279249062

## Sources

Its oscillations, recorded by TESS, give 0.88 solar masses and 15.7 solar radii; APOGEE spectra give 4,329 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5484873696002712320, distance 1,041 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 279249062 (observed by TESS): PARAM asteroseismic distance (pc) 1040.810547 (16th-84th percentiles 1033.017578-1049.462891), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.911 ± 0.012 mas (78.9 standard errors), is not used. Radius 15.6657 +/- 4.0047 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 279249062 (observed by TESS): PARAM radius (solar radii) 15.665706 (16th-84th percentiles 15.482672-23.492088), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8805 +/- 0.4839 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 279249062 (observed by TESS): PARAM mass (solar masses) 0.880548 (16th-84th percentiles 0.845943-1.813791), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,329 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 279249062: APOGEE DR17 effective temperature 4329.2954 +/- 50 K (the catalogue's final uncertainty). log g 1.99 from the mass and radius.

**Colour.** A Planck spectrum at 4,329 K, because pARAM fits an extinction A_V = 0.38 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdab4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,329 K and log g 1.99 (u1 0.828, u2 -0.005): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
