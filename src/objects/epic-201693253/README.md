# EPIC 201693253

## Sources

Its oscillations, recorded in K2 campaign 1, give 1.07 solar masses and 12.8 solar radii; APOGEE spectra give 4,597 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3812519224573358080, distance 3,216 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201693253 (K2 campaign 1): PARAM asteroseismic distance (pc) 3215.9375 (16th-84th percentiles 3102.1875-3332.109375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.330 ± 0.020 mas (16.7 standard errors), is not used. Radius 12.7829 +/- 0.5853 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201693253 (K2 campaign 1): PARAM radius (solar radii) 12.782945 (16th-84th percentiles 12.205796-13.376391), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0709 +/- 0.1249 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201693253 (K2 campaign 1): PARAM mass (solar masses) 1.070893 (16th-84th percentiles 0.952212-1.20203), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,597 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201693253: APOGEE DR17 effective temperature 4596.766 +/- 50 K (the catalogue's final uncertainty). log g 2.25 from the mass and radius.

**Colour.** A Planck spectrum at 4,597 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,597 K and log g 2.25 (u1 0.744, u2 0.061): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
