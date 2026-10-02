# EPIC 246384695

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.86 solar masses and 10.4 solar radii; APOGEE spectra give 4,784 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2638539976350630912, distance 3,139 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246384695 (K2 campaign 12): PARAM asteroseismic distance (pc) 3139.257812 (16th-84th percentiles 3062.773438-3220.546875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.336 ± 0.015 mas (22.8 standard errors), is not used. Radius 10.4211 +/- 0.3635 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246384695 (K2 campaign 12): PARAM radius (solar radii) 10.421109 (16th-84th percentiles 10.08225-10.809183), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8598 +/- 0.0669 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246384695 (K2 campaign 12): PARAM mass (solar masses) 0.859823 (16th-84th percentiles 0.797982-0.931795), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,784 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246384695: APOGEE DR17 effective temperature 4784.0127 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Color.** A Planck spectrum at 4,784 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,784 K and log g 2.34 (u1 0.687, u2 0.105): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
