# EPIC 201814851

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.92 solar masses and 8.0 solar radii; APOGEE spectra give 4,984 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3896726559537882368, distance 3,333 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201814851 (K2 campaign 1): PARAM asteroseismic distance (pc) 3333.4375 (16th-84th percentiles 3220.15625-3452.5), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.250 ± 0.018 mas (13.7 standard errors), is not used. Radius 8.0311 +/- 0.3586 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201814851 (K2 campaign 1): PARAM radius (solar radii) 8.031146 (16th-84th percentiles 7.68762-8.404795), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9239 +/- 0.1045 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201814851 (K2 campaign 1): PARAM mass (solar masses) 0.923886 (16th-84th percentiles 0.826785-1.035823), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,984 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201814851: APOGEE DR17 effective temperature 4983.978 +/- 50 K (the catalogue's final uncertainty). log g 2.59 from the mass and radius.

**Colour.** A Planck spectrum at 4,984 K, because pARAM fits an extinction A_V = -0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,984 K and log g 2.59 (u1 0.630, u2 0.147): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
