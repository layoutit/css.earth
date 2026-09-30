# EPIC 248870156

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.88 solar masses and 8.0 solar radii; APOGEE spectra give 4,733 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3872568880325590656, distance 3,068 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248870156 (K2 campaign 14): PARAM asteroseismic distance (pc) 3067.929688 (16th-84th percentiles 2994.101562-3162.460938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.246 ± 0.020 mas (12.5 standard errors), is not used. Radius 7.9808 +/- 0.2738 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248870156 (K2 campaign 14): PARAM radius (solar radii) 7.980824 (16th-84th percentiles 7.754349-8.302045), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8828 +/- 0.0751 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248870156 (K2 campaign 14): PARAM mass (solar masses) 0.882755 (16th-84th percentiles 0.823648-0.973797), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,733 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248870156: APOGEE DR17 effective temperature 4733.427 +/- 50 K (the catalogue's final uncertainty). log g 2.58 from the mass and radius.

**Colour.** A Planck spectrum at 4,733 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,733 K and log g 2.58 (u1 0.705, u2 0.091): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
