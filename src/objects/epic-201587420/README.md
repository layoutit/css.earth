# EPIC 201587420

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.92 solar masses and 8.9 solar radii; APOGEE spectra give 5,040 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3796480133063089920, distance 5,573 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201587420 (K2 campaign 1): PARAM asteroseismic distance (pc) 5573.359375 (16th-84th percentiles 5385.78125-5769.0625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.121 ± 0.027 mas (4.5 standard errors), is not used. Radius 8.8731 +/- 0.4038 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201587420 (K2 campaign 1): PARAM radius (solar radii) 8.873054 (16th-84th percentiles 8.484912-9.292437), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9192 +/- 0.1078 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201587420 (K2 campaign 1): PARAM mass (solar masses) 0.91923 (16th-84th percentiles 0.818819-1.034482), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,040 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201587420: APOGEE DR17 effective temperature 5039.632000000001 +/- 50 K (the catalogue's final uncertainty). log g 2.51 from the mass and radius.

**Colour.** A Planck spectrum at 5,040 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,040 K and log g 2.51 (u1 0.614, u2 0.158): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
