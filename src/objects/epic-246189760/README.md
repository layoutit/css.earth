# EPIC 246189760

## Sources

Its oscillations, recorded in K2 campaign 12, give 1.29 solar masses and 11.5 solar radii; APOGEE spectra give 4,973 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2633201984836515200, distance 6,902 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246189760 (K2 campaign 12): PARAM asteroseismic distance (pc) 6902.03125 (16th-84th percentiles 6702.890625-7027.03125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.145 ± 0.028 mas (5.2 standard errors), is not used. Radius 11.5233 +/- 0.4493 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246189760 (K2 campaign 12): PARAM radius (solar radii) 11.523287 (16th-84th percentiles 10.916878-11.815541), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2924 +/- 0.124 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246189760 (K2 campaign 12): PARAM mass (solar masses) 1.292414 (16th-84th percentiles 1.146887-1.394945), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,973 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246189760: APOGEE DR17 effective temperature 4972.6616 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 4,973 K, because pARAM fits an extinction A_V = 0.35 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,973 K and log g 2.43 (u1 0.632, u2 0.145): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
