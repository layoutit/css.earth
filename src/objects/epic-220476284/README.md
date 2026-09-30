# EPIC 220476284

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.88 solar masses and 9.5 solar radii; APOGEE spectra give 4,585 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2564631663724742784, distance 3,580 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220476284 (K2 campaign 8): PARAM asteroseismic distance (pc) 3580 (16th-84th percentiles 3506.71875-3671.484375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.255 ± 0.021 mas (12.1 standard errors), is not used. Radius 9.4943 +/- 0.2793 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220476284 (K2 campaign 8): PARAM radius (solar radii) 9.494254 (16th-84th percentiles 9.265449-9.824119), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8838 +/- 0.0621 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220476284 (K2 campaign 8): PARAM mass (solar masses) 0.883812 (16th-84th percentiles 0.835483-0.959749), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,585 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220476284: APOGEE DR17 effective temperature 4585.0723 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 4,585 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,585 K and log g 2.43 (u1 0.751, u2 0.055): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
