# EPIC 210323564

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.64 solar masses and 10.8 solar radii; APOGEE spectra give 4,838 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3303332022495463552, distance 1,028 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210323564 (K2 campaign 4): PARAM asteroseismic distance (pc) 1027.822266 (16th-84th percentiles 1017.65625-1039.726562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.927 ± 0.020 mas (46.4 standard errors), is not used. Radius 10.776 +/- 0.1307 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210323564 (K2 campaign 4): PARAM radius (solar radii) 10.776024 (16th-84th percentiles 10.706622-10.967948), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.638 +/- 0.0484 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210323564 (K2 campaign 4): PARAM mass (solar masses) 1.637984 (16th-84th percentiles 1.609414-1.7062), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,838 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210323564: APOGEE DR17 effective temperature 4838.0664 +/- 50 K (the catalogue's final uncertainty). log g 2.59 from the mass and radius.

**Colour.** A Planck spectrum at 4,838 K, because pARAM fits an extinction A_V = 0.88 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,838 K and log g 2.59 (u1 0.674, u2 0.115): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
