# EPIC 211477011

## Sources

Its oscillations, recorded in K2 campaign 16, give 0.90 solar masses and 10.1 solar radii; APOGEE spectra give 4,808 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 604535136746962304, distance 2,719 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211477011 (K2 campaign 16): PARAM asteroseismic distance (pc) 2719.0625 (16th-84th percentiles 2667.929688-2771.09375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.343 ± 0.017 mas (19.8 standard errors), is not used. Radius 10.0776 +/- 0.2399 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211477011 (K2 campaign 16): PARAM radius (solar radii) 10.077623 (16th-84th percentiles 9.837712-10.317506), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9029 +/- 0.0563 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211477011 (K2 campaign 16): PARAM mass (solar masses) 0.902873 (16th-84th percentiles 0.850396-0.962912), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,808 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211477011: APOGEE DR17 effective temperature 4808.0186 +/- 62 K (the catalogue's final uncertainty). log g 2.39 from the mass and radius.

**Colour.** A Planck spectrum at 4,808 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,808 K and log g 2.39 (u1 0.680, u2 0.110): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
