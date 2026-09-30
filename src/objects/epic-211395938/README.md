# EPIC 211395938

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.81 solar masses and 12.9 solar radii; APOGEE spectra give 4,589 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 604893268300548224, distance 4,302 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211395938 (K2 campaign 5): PARAM asteroseismic distance (pc) 4301.796875 (16th-84th percentiles 4226.953125-4397.265625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.171 ± 0.018 mas (9.5 standard errors), is not used. Radius 12.8546 +/- 0.372 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211395938 (K2 campaign 5): PARAM radius (solar radii) 12.854602 (16th-84th percentiles 12.566696-13.310701), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8119 +/- 0.0521 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211395938 (K2 campaign 5): PARAM mass (solar masses) 0.811899 (16th-84th percentiles 0.77508-0.879355), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,589 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211395938: APOGEE DR17 effective temperature 4589.1367 +/- 50 K (the catalogue's final uncertainty). log g 2.13 from the mass and radius.

**Colour.** A Planck spectrum at 4,589 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,589 K and log g 2.13 (u1 0.745, u2 0.061): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
