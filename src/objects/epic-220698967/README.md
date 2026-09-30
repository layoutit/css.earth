# EPIC 220698967

## Sources

Its oscillations, recorded in K2 campaign 8, give 1.09 solar masses and 12.5 solar radii; APOGEE spectra give 4,627 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2580469647686592896, distance 2,483 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220698967 (K2 campaign 8): PARAM asteroseismic distance (pc) 2482.5 (16th-84th percentiles 2386.816406-2582.421875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.420 ± 0.015 mas (27.6 standard errors), is not used. Radius 12.5055 +/- 0.6597 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220698967 (K2 campaign 8): PARAM radius (solar radii) 12.505518 (16th-84th percentiles 11.868476-13.187862), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.09 +/- 0.1328 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220698967 (K2 campaign 8): PARAM mass (solar masses) 1.089967 (16th-84th percentiles 0.965639-1.231182), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,627 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220698967: APOGEE DR17 effective temperature 4627.315 +/- 50 K (the catalogue's final uncertainty). log g 2.28 from the mass and radius.

**Colour.** A Planck spectrum at 4,627 K, because pARAM fits an extinction A_V = 0.19 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,627 K and log g 2.28 (u1 0.735, u2 0.068): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
