# EPIC 205983689

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.95 solar masses and 5.4 solar radii; APOGEE spectra give 4,854 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2598851244425056256, distance 1,712 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205983689 (K2 campaign 3): PARAM asteroseismic distance (pc) 1712.285156 (16th-84th percentiles 1667.949219-1758.789062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.554 ± 0.015 mas (36.2 standard errors), is not used. Radius 5.3532 +/- 0.1709 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205983689 (K2 campaign 3): PARAM radius (solar radii) 5.353178 (16th-84th percentiles 5.189842-5.531652), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9482 +/- 0.0739 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205983689 (K2 campaign 3): PARAM mass (solar masses) 0.948226 (16th-84th percentiles 0.879181-1.026938), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,854 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205983689: APOGEE DR17 effective temperature 4854.2803 +/- 50 K (the catalogue's final uncertainty). log g 2.96 from the mass and radius.

**Colour.** A Planck spectrum at 4,854 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,854 K and log g 2.96 (u1 0.675, u2 0.113): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
