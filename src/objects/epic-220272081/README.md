# EPIC 220272081

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.85 solar masses and 14.3 solar radii; APOGEE spectra give 4,500 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2550315300776978432, distance 2,235 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220272081 (K2 campaign 8): PARAM asteroseismic distance (pc) 2234.941406 (16th-84th percentiles 2187.167969-2295.742188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.393 ± 0.021 mas (18.8 standard errors), is not used. Radius 14.3464 +/- 0.5477 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220272081 (K2 campaign 8): PARAM radius (solar radii) 14.346357 (16th-84th percentiles 13.91899-15.014465), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8527 +/- 0.073 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220272081 (K2 campaign 8): PARAM mass (solar masses) 0.852686 (16th-84th percentiles 0.798962-0.94494), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,500 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220272081: APOGEE DR17 effective temperature 4499.765 +/- 50 K (the catalogue's final uncertainty). log g 2.06 from the mass and radius.

**Colour.** A Planck spectrum at 4,500 K, because pARAM fits an extinction A_V = 0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,500 K and log g 2.06 (u1 0.772, u2 0.041): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
