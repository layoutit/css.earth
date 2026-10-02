# EPIC 248869892

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.93 solar masses and 18.4 solar radii; APOGEE spectra give 4,837 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3871821659095234176, distance 10,555 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248869892 (K2 campaign 14): PARAM asteroseismic distance (pc) 10554.6875 (16th-84th percentiles 9986.875-11176.5625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.014 ± 0.028 mas (0.5 standard errors), is not used. Radius 18.3705 +/- 1.3807 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248869892 (K2 campaign 14): PARAM radius (solar radii) 18.370463 (16th-84th percentiles 17.103225-19.864536), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9346 +/- 0.1564 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248869892 (K2 campaign 14): PARAM mass (solar masses) 0.934616 (16th-84th percentiles 0.797321-1.110048), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,837 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248869892: APOGEE DR17 effective temperature 4836.707 +/- 50 K (the catalogue's final uncertainty). log g 1.88 from the mass and radius.

**Color.** A Planck spectrum at 4,837 K, because pARAM fits an extinction A_V = 0.02 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,837 K and log g 1.88 (u1 0.667, u2 0.119): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
