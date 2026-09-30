# EPIC 246340442

## Sources

Its oscillations, recorded in K2 campaign 12, give 2.51 solar masses and 17.1 solar radii; APOGEE spectra give 5,076 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2648908126186910464, distance 3,665 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246340442 (K2 campaign 12): PARAM asteroseismic distance (pc) 3664.453125 (16th-84th percentiles 3551.914062-3849.414062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.509 ± 0.015 mas (35.1 standard errors), is not used. Radius 17.1431 +/- 0.7289 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246340442 (K2 campaign 12): PARAM radius (solar radii) 17.143072 (16th-84th percentiles 16.517874-17.975653), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.5105 +/- 0.2339 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246340442 (K2 campaign 12): PARAM mass (solar masses) 2.510488 (16th-84th percentiles 2.322489-2.79036), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,076 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246340442: APOGEE DR17 effective temperature 5075.773 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 5,076 K, because pARAM fits an extinction A_V = 0.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,076 K and log g 2.37 (u1 0.603, u2 0.165): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
