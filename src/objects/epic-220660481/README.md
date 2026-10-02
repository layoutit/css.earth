# EPIC 220660481

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.93 solar masses and 8.4 solar radii; APOGEE spectra give 4,800 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2579928791045022336, distance 2,987 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220660481 (K2 campaign 8): PARAM asteroseismic distance (pc) 2987.382812 (16th-84th percentiles 2887.8125-3092.1875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.277 ± 0.016 mas (16.8 standard errors), is not used. Radius 8.401 +/- 0.3553 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220660481 (K2 campaign 8): PARAM radius (solar radii) 8.401017 (16th-84th percentiles 8.066534-8.777144), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.93 +/- 0.0936 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220660481 (K2 campaign 8): PARAM mass (solar masses) 0.930034 (16th-84th percentiles 0.844154-1.031386), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,800 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220660481: APOGEE DR17 effective temperature 4799.9683 +/- 50 K (the catalogue's final uncertainty). log g 2.56 from the mass and radius.

**Color.** A Planck spectrum at 4,800 K, because pARAM fits an extinction A_V = 0.19 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,800 K and log g 2.56 (u1 0.685, u2 0.107): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
