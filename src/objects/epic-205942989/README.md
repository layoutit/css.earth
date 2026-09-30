# EPIC 205942989

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.84 solar masses and 24.4 solar radii; APOGEE spectra give 4,265 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2598598769066901632, distance 3,172 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205942989 (K2 campaign 3): PARAM asteroseismic distance (pc) 3171.914062 (16th-84th percentiles 3107.03125-3252.03125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.316 ± 0.016 mas (19.8 standard errors), is not used. Radius 24.429 +/- 0.7285 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205942989 (K2 campaign 3): PARAM radius (solar radii) 24.429028 (16th-84th percentiles 23.80574-25.262721), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8362 +/- 0.0483 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205942989 (K2 campaign 3): PARAM mass (solar masses) 0.836176 (16th-84th percentiles 0.803341-0.899955), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,265 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205942989: APOGEE DR17 effective temperature 4264.7593 +/- 50 K (the catalogue's final uncertainty). log g 1.58 from the mass and radius.

**Colour.** A Planck spectrum at 4,265 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffd9b2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,265 K and log g 1.58 (u1 0.847, u2 -0.020): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
