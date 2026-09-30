# EPIC 247496647

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.21 solar masses and 10.6 solar radii; APOGEE spectra give 4,948 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3418234251775792896, distance 3,637 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247496647 (K2 campaign 13): PARAM asteroseismic distance (pc) 3637.1875 (16th-84th percentiles 3595.117188-3681.210938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.258 ± 0.026 mas (10.0 standard errors), is not used. Radius 10.5746 +/- 0.1509 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247496647 (K2 campaign 13): PARAM radius (solar radii) 10.57463 (16th-84th percentiles 10.450737-10.752478), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2092 +/- 0.0549 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247496647 (K2 campaign 13): PARAM mass (solar masses) 1.209237 (16th-84th percentiles 1.153299-1.263052), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,948 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247496647: APOGEE DR17 effective temperature 4947.7 +/- 50 K (the catalogue's final uncertainty). log g 2.47 from the mass and radius.

**Colour.** A Planck spectrum at 4,948 K, because pARAM fits an extinction A_V = 1.31 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5ce. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,948 K and log g 2.47 (u1 0.639, u2 0.140): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
