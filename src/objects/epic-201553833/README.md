# EPIC 201553833

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.88 solar masses and 15.2 solar radii; APOGEE spectra give 4,370 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3810614045800315264, distance 3,160 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201553833 (K2 campaign 1): PARAM asteroseismic distance (pc) 3160.273438 (16th-84th percentiles 3096.171875-3240.9375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.295 ± 0.020 mas (14.5 standard errors), is not used. Radius 15.2013 +/- 0.4908 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201553833 (K2 campaign 1): PARAM radius (solar radii) 15.201308 (16th-84th percentiles 14.818781-15.800354), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8837 +/- 0.0713 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201553833 (K2 campaign 1): PARAM mass (solar masses) 0.883748 (16th-84th percentiles 0.83225-0.974856), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,370 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201553833: APOGEE DR17 effective temperature 4370.28 +/- 50 K (the catalogue's final uncertainty). log g 2.02 from the mass and radius.

**Colour.** A Planck spectrum at 4,370 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdbb6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,370 K and log g 2.02 (u1 0.814, u2 0.006): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
