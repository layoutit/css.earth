# EPIC 212303202

## Sources

Its oscillations, recorded in K2 campaign 6, give 1.00 solar masses and 7.1 solar radii; APOGEE spectra give 4,754 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3604289967293931904, distance 2,375 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212303202 (K2 campaign 6): PARAM asteroseismic distance (pc) 2375.078125 (16th-84th percentiles 2305.878906-2446.542969), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.433 ± 0.016 mas (26.6 standard errors), is not used. Radius 7.0541 +/- 0.2494 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212303202 (K2 campaign 6): PARAM radius (solar radii) 7.054128 (16th-84th percentiles 6.81192-7.310756), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9961 +/- 0.0852 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212303202 (K2 campaign 6): PARAM mass (solar masses) 0.996102 (16th-84th percentiles 0.914855-1.08535), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,754 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212303202: APOGEE DR17 effective temperature 4753.8223 +/- 50 K (the catalogue's final uncertainty). log g 2.74 from the mass and radius.

**Color.** A Planck spectrum at 4,754 K, because pARAM fits an extinction A_V = 0.21 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,754 K and log g 2.74 (u1 0.701, u2 0.094): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
