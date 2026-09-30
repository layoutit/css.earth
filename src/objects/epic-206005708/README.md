# EPIC 206005708

## Sources

Its oscillations, recorded in K2 campaign 3, give 1.10 solar masses and 9.1 solar radii; APOGEE spectra give 4,846 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6839401790116242432, distance 3,529 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206005708 (K2 campaign 3): PARAM asteroseismic distance (pc) 3528.945312 (16th-84th percentiles 3418.515625-3644.609375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.274 ± 0.017 mas (15.9 standard errors), is not used. Radius 9.0737 +/- 0.3805 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206005708 (K2 campaign 3): PARAM radius (solar radii) 9.073685 (16th-84th percentiles 8.705077-9.465979), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1016 +/- 0.1099 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206005708 (K2 campaign 3): PARAM mass (solar masses) 1.101566 (16th-84th percentiles 0.9981-1.217999), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,846 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206005708: APOGEE DR17 effective temperature 4846.3613 +/- 50 K (the catalogue's final uncertainty). log g 2.56 from the mass and radius.

**Colour.** A Planck spectrum at 4,846 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,846 K and log g 2.56 (u1 0.671, u2 0.117): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
