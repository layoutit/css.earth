# EPIC 201794967

## Sources

Its oscillations, recorded in K2 campaign 1, give 1.05 solar masses and 20.7 solar radii; APOGEE spectra give 4,454 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3816853701273036032, distance 3,102 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201794967 (K2 campaign 1): PARAM asteroseismic distance (pc) 3101.757812 (16th-84th percentiles 2954.570312-3255.664062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.293 ± 0.017 mas (16.9 standard errors), is not used. Radius 20.653 +/- 1.2551 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201794967 (K2 campaign 1): PARAM radius (solar radii) 20.652954 (16th-84th percentiles 19.463019-21.973224), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0456 +/- 0.1595 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201794967 (K2 campaign 1): PARAM mass (solar masses) 1.045594 (16th-84th percentiles 0.900247-1.219231), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,454 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201794967: APOGEE DR17 effective temperature 4453.626 +/- 50 K (the catalogue's final uncertainty). log g 1.83 from the mass and radius.

**Colour.** A Planck spectrum at 4,454 K, because pARAM fits an extinction A_V = 0.19 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddba. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,454 K and log g 1.83 (u1 0.784, u2 0.031): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
