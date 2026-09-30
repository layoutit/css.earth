# EPIC 203486964

## Sources

Its oscillations, recorded in K2 campaign 2, give 0.88 solar masses and 12.6 solar radii; APOGEE spectra give 4,412 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6043452300434325120, distance 3,624 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 203486964 (K2 campaign 2): PARAM asteroseismic distance (pc) 3624.140625 (16th-84th percentiles 3556.757812-3702.851562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.206 ± 0.021 mas (9.7 standard errors), is not used. Radius 12.553 +/- 0.3458 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 203486964 (K2 campaign 2): PARAM radius (solar radii) 12.552992 (16th-84th percentiles 12.284193-12.975743), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8789 +/- 0.054 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 203486964 (K2 campaign 2): PARAM mass (solar masses) 0.878927 (16th-84th percentiles 0.840723-0.948633), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,412 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 203486964: APOGEE DR17 effective temperature 4411.567 +/- 50 K (the catalogue's final uncertainty). log g 2.18 from the mass and radius.

**Colour.** A Planck spectrum at 4,412 K, because pARAM fits an extinction A_V = 0.94 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,412 K and log g 2.18 (u1 0.803, u2 0.015): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
