# EPIC 201126598

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.53 solar masses and 11.7 solar radii; APOGEE spectra give 4,744 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3595800672374708736, distance 1,214 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201126598 (K2 campaign 10): PARAM asteroseismic distance (pc) 1214.072266 (16th-84th percentiles 1177.519531-1265.322266), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.773 ± 0.016 mas (47.3 standard errors), is not used. Radius 11.6644 +/- 0.5063 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201126598 (K2 campaign 10): PARAM radius (solar radii) 11.66435 (16th-84th percentiles 11.173569-12.186205), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.5265 +/- 0.1422 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201126598 (K2 campaign 10): PARAM mass (solar masses) 1.526527 (16th-84th percentiles 1.396453-1.680788), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,744 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201126598: APOGEE DR17 effective temperature 4743.9854 +/- 50 K (the catalogue's final uncertainty). log g 2.49 from the mass and radius.

**Colour.** A Planck spectrum at 4,744 K, because pARAM fits an extinction A_V = -0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,744 K and log g 2.49 (u1 0.700, u2 0.095): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
