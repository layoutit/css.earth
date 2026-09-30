# EPIC 211082656

## Sources

Its oscillations, recorded in K2 campaign 4, give 0.80 solar masses and 11.1 solar radii; APOGEE spectra give 4,894 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 65841646787579392, distance 3,336 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211082656 (K2 campaign 4): PARAM asteroseismic distance (pc) 3336.289062 (16th-84th percentiles 3291.953125-3384.257812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.285 ± 0.022 mas (13.2 standard errors), is not used. Radius 11.0526 +/- 0.224 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211082656 (K2 campaign 4): PARAM radius (solar radii) 11.052639 (16th-84th percentiles 10.856771-11.30473), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8037 +/- 0.0355 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211082656 (K2 campaign 4): PARAM mass (solar masses) 0.8037 (16th-84th percentiles 0.776862-0.847906), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,894 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211082656: APOGEE DR17 effective temperature 4894.1685 +/- 50 K (the catalogue's final uncertainty). log g 2.26 from the mass and radius.

**Colour.** A Planck spectrum at 4,894 K, because pARAM fits an extinction A_V = 0.32 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,894 K and log g 2.26 (u1 0.653, u2 0.130): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
