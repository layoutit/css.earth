# EPIC 211003469

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.54 solar masses and 11.7 solar radii; APOGEE spectra give 4,791 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 64857755677653248, distance 2,934 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211003469 (K2 campaign 4): PARAM asteroseismic distance (pc) 2933.710938 (16th-84th percentiles 2843.125-3121.601562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.252 ± 0.017 mas (14.6 standard errors), is not used. Radius 11.6529 +/- 0.5297 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211003469 (K2 campaign 4): PARAM radius (solar radii) 11.652887 (16th-84th percentiles 11.14324-12.202623), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.5391 +/- 0.1615 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211003469 (K2 campaign 4): PARAM mass (solar masses) 1.539087 (16th-84th percentiles 1.390558-1.713549), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,791 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211003469: APOGEE DR17 effective temperature 4791.165 +/- 50 K (the catalogue's final uncertainty). log g 2.49 from the mass and radius.

**Colour.** A Planck spectrum at 4,791 K, because pARAM fits an extinction A_V = 0.49 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,791 K and log g 2.49 (u1 0.686, u2 0.106): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
