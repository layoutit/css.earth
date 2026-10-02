# EPIC 212418305

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.85 solar masses and 16.6 solar radii; APOGEE spectra give 4,366 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6301471013330754560, distance 4,487 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212418305 (K2 campaign 6): PARAM asteroseismic distance (pc) 4486.71875 (16th-84th percentiles 4405.976562-4586.40625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.231 ± 0.021 mas (11.1 standard errors), is not used. Radius 16.62 +/- 0.5243 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212418305 (K2 campaign 6): PARAM radius (solar radii) 16.61999 (16th-84th percentiles 16.210621-17.259302), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8522 +/- 0.056 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212418305 (K2 campaign 6): PARAM mass (solar masses) 0.852234 (16th-84th percentiles 0.81432-0.926231), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,366 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212418305: APOGEE DR17 effective temperature 4365.5015 +/- 50 K (the catalogue's final uncertainty). log g 1.93 from the mass and radius.

**Color.** A Planck spectrum at 4,366 K, because pARAM fits an extinction A_V = 0.22 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdbb6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,366 K and log g 1.93 (u1 0.815, u2 0.006): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
