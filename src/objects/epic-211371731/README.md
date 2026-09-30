# EPIC 211371731

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.22 solar masses and 15.1 solar radii; APOGEE spectra give 5,148 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 601818999429129088, distance 9,760 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211371731 (K2 campaign 5): PARAM asteroseismic distance (pc) 9759.921875 (16th-84th percentiles 9304.453125-10240.9375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.043 ± 0.028 mas (1.6 standard errors), is not used. Radius 15.0592 +/- 0.9623 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211371731 (K2 campaign 5): PARAM radius (solar radii) 15.059194 (16th-84th percentiles 14.133923-16.058542), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2162 +/- 0.1765 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211371731 (K2 campaign 5): PARAM mass (solar masses) 1.216206 (16th-84th percentiles 1.055735-1.408648), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,148 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211371731: APOGEE DR17 effective temperature 5148.2065 +/- 50 K (the catalogue's final uncertainty). log g 2.17 from the mass and radius.

**Colour.** A Planck spectrum at 5,148 K, because pARAM fits an extinction A_V = -0.02 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,148 K and log g 2.17 (u1 0.583, u2 0.178): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
