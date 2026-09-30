# EPIC 220178579

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.99 solar masses and 10.3 solar radii; APOGEE spectra give 4,878 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2535926644939179136, distance 5,258 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220178579 (K2 campaign 8): PARAM asteroseismic distance (pc) 5258.046875 (16th-84th percentiles 5067.851562-5453.4375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.150 ± 0.021 mas (7.3 standard errors), is not used. Radius 10.3281 +/- 0.5044 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220178579 (K2 campaign 8): PARAM radius (solar radii) 10.328066 (16th-84th percentiles 9.835339-10.844164), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9931 +/- 0.114 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220178579 (K2 campaign 8): PARAM mass (solar masses) 0.993089 (16th-84th percentiles 0.884913-1.112868), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,878 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220178579: APOGEE DR17 effective temperature 4878.123 +/- 50 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Colour.** A Planck spectrum at 4,878 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,878 K and log g 2.41 (u1 0.660, u2 0.125): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
