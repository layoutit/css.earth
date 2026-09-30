# EPIC 248779698

## Sources

Its oscillations, recorded in K2 campaign 14, give 1.51 solar masses and 11.2 solar radii; APOGEE spectra give 5,020 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3882152532910990592, distance 7,352 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248779698 (K2 campaign 14): PARAM asteroseismic distance (pc) 7351.640625 (16th-84th percentiles 6961.25-7674.0625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.104 ± 0.025 mas (4.2 standard errors), is not used. Radius 11.231 +/- 0.5239 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248779698 (K2 campaign 14): PARAM radius (solar radii) 11.231017 (16th-84th percentiles 10.715428-11.763198), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.5141 +/- 0.1578 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248779698 (K2 campaign 14): PARAM mass (solar masses) 1.514106 (16th-84th percentiles 1.361005-1.676682), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,020 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248779698: APOGEE DR17 effective temperature 5019.89 +/- 50 K (the catalogue's final uncertainty). log g 2.52 from the mass and radius.

**Colour.** A Planck spectrum at 5,020 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,020 K and log g 2.52 (u1 0.619, u2 0.154): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
