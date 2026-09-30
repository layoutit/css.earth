# EPIC 212032934

## Sources

Its oscillations, recorded in K2 campaign 16, give 0.87 solar masses and 10.2 solar radii; APOGEE spectra give 4,635 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 637038384091984000, distance 1,268 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212032934 (K2 campaign 16): PARAM asteroseismic distance (pc) 1268.271484 (16th-84th percentiles 1253.427734-1283.691406), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.704 ± 0.023 mas (30.2 standard errors), is not used. Radius 10.1548 +/- 0.1513 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212032934 (K2 campaign 16): PARAM radius (solar radii) 10.15479 (16th-84th percentiles 10.018619-10.321307), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.869 +/- 0.0324 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212032934 (K2 campaign 16): PARAM mass (solar masses) 0.869023 (16th-84th percentiles 0.843821-0.908588), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,635 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212032934: APOGEE DR17 effective temperature 4635.345 +/- 50 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Colour.** A Planck spectrum at 4,635 K, because pARAM fits an extinction A_V = 0.19 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,635 K and log g 2.36 (u1 0.734, u2 0.069): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
