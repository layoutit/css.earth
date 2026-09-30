# EPIC 211330393

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.93 solar masses and 24.0 solar radii; APOGEE spectra give 4,358 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 598578631286985984, distance 3,896 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211330393 (K2 campaign 5): PARAM asteroseismic distance (pc) 3895.742188 (16th-84th percentiles 3719.53125-4136.40625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.297 ± 0.015 mas (20.1 standard errors), is not used. Radius 23.9976 +/- 1.8482 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211330393 (K2 campaign 5): PARAM radius (solar radii) 23.997582 (16th-84th percentiles 22.502983-26.199406), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9288 +/- 0.1545 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211330393 (K2 campaign 5): PARAM mass (solar masses) 0.928767 (16th-84th percentiles 0.810157-1.119194), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,358 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211330393: APOGEE DR17 effective temperature 4357.6787 +/- 50 K (the catalogue's final uncertainty). log g 1.65 from the mass and radius.

**Colour.** A Planck spectrum at 4,358 K, because pARAM fits an extinction A_V = 0.27 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdbb6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,358 K and log g 1.65 (u1 0.816, u2 0.005): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
